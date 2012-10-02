/*
 * Copyright 2012 Sakai Foundation (SF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 * 
 *     http://www.osedu.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */


var fs = require('fs');
var temp = require('temp')
var querystring = require('querystring');
var util = require('util');
var exec = require('child_process').exec;

var Tsung = module.exports.Tsung = function(config) {
    var clients = [];
    var servers = [];
    var phases = [];
    var sessions = [];

    var that = {};

    /**
     * Adds a client that will be used to drive traffic from.
     * @param {String}  host            A hostname
     * @param {Boolean} useControllerVM Whether to use the Erlang VM
     * @param {Number}  maxUsers        The maximum number of users that this test should create.
     */
    that.addClient = function(host, useControllerVM, maxUsers) {
        clients.push({'host': host, 'useControllerVM': useControllerVM, 'maxUsers': maxUsers});
    };

    /**
     * Adds a server that will be tested.
     * @param {String} host The hostname of the server to test.
     * @param {Number} port The port the server is running on. (Defaults to 80 if empty)
     */
    that.addServer = function(host, port) {
        port = port || 80;
        servers.push({'host': host, 'port': port});
    };

    /**
     * Adds a loading phase.
     * @param {Number} duration     How long the phase should take in `unit`.
     * @param {String} unit         The unit that the `duration` value is expressed in.
     *                              One of `hour`, `minute` or `second`.
     * @param {Number} newUsers     The amount of users that should be added per `newUserUnit` 
     * @param {String} newUsersUnit One of `hour`, `minute` or `second`.)
     */
    that.addPhase = function(duration, unit, newUsers, newUsersUnit) {
        phases.push(new Phase(phases.length+1, duration, unit, newUsers, newUsersUnit));
    };

    // TODO: Options


    /**
     * Create a new session.
     * @param {String} name        The name for this session.
     * @param {Number} probability The probability that this session will be executed.
     *                             Defaults to `100` if nothing is provided.
     */
    that.addSession = function(name, probability) {
        probability = probability || 100;
        var session = new Session(name, probability);
        sessions.push(session);
        return session;
    };

    /**
     * @return {String} Generate a tsung compatible file.
     */
    that.to_xml = function() {
        var xml = '<?xml version="1.0"?>';
        xml += '<!DOCTYPE tsung SYSTEM "/opt/local/share/tsung/tsung-1.0.dtd" []>';
        xml += util.format('<tsung loglevel="%s" version="%s" dumptraffic="%s">', config.loglevel, config.version, config.dumpTraffic);

        // Clients.
        xml += '<clients>';
        for (var i = 0; i < clients.length; i++) {
            var client = clients[i];
            xml += util.format('<client host="%s" use_controller_vm="%s" maxusers="%d" />', client.host, client.useControllerVM, client.maxUsers);
        }
        xml += '</clients>';

        // Servers
        xml += '<servers>';
        for (var i = 0; i < servers.length; i++) {
            var server = servers[i];
            xml += util.format('<server host="%s" port="%s" type="tcp" />', server.host, server.port);
        }
        xml += '</servers>';

        // The arrival phases.
        xml += '<load>';
        for (var i = 0; i < phases.length; i++) {
            var phase = phases[i];
            xml += phase.to_xml();
        }
        xml += '</load>';

  
        // TODO: Options
        xml += '<options>';
        xml += '<option type="ts_http" name="user_agent">';
        xml += '<user_agent probability="80">Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.7.8) Gecko/20050513 Galeon/1.3.21</user_agent>';
        xml += '<user_agent probability="20">Mozilla/5.0 (Windows; U; Windows NT 5.2; fr-FR; rv:1.7.8) Gecko/20050511 Firefox/1.0.4</user_agent>';
        xml += '</option>';
        xml += '</options>';
        

        // Sessions
        xml += '<sessions>';
        for (var i = 0; i < sessions.length; i++) {
            xml += sessions[i].to_xml();
        }
        xml += '</sessions>';


        xml += '</tsung>';
        return xml;
    };

    /**
     * Write the XML to a file.
     * @param {Function(err, info)} callback        A callback method.
     * @param {Object}              callback.err    An error object (if any)
     * @param {Object}              callback.info   An info object that contains the path where the file has been written to.
     */
    that.writeXml = function(callback) {
        // Generate xml.
        var xml = that.to_xml();

        // Write it to a tmp file.
        temp.open({prefix: "tsung_", suffix: ".xml"}, function(err, info) {
            if (err) {
                return console.error('Couldn\'t generate a temporary file.');
            }

            fs.write(info.fd, xml);
            fs.close(info.fd, function(err) {
                if (err) {
                    return console.error('Couldn\'t write to a temporary file.');
                }
                console.log('Wrote XML file to: ' + info.path);
                callback(err, info);
            });
        });
    };

    /**
     * Run the tsung test.
     */
    that.run = function() {
        // Write the xml somewhere.
        that.writeXml(function(err, info) {
            if (err) {
                return;
            }

            // Execute tsung (assume it's in the PATH)
            console.log('Starting test');
            exec('tsung -f ' + info.path + ' start', function(err, stdout) {
                console.log(stdout);
            });
        });
    };

    return that;
};

var Phase = function(id, duration, unit, newUsers, newUsersUnit) {
    var that = {};
    that.to_xml = function() {
        var xml = util.format('<arrivalphase phase="%d" duration="%d" unit="%s">', id, duration, unit);
        xml += util.format('<users arrivalrate="%d" unit="%s" />', newUsers, newUsersUnit);
        xml += '</arrivalphase>';
        return xml;
    };
    return that;
};


var Session = function(name, probability) {
    var actions = [];

    var that = {};
    that.name = name;
    that.probability = probability;

    /**
     * Create a new transaction.
     *
     * @param  {String} name The name of your transaction.
     * @return {Transaction} Returns a transactions where you can attach requests on.
     */
    that.addTransaction = function(name) {
        var transaction = new Transaction(name);
        actions.push(transaction);
        return transaction;
    };

    /**
     * Add some thinktime.
     *
     * @param  {Number}  seconds  The number of seconds that we should wait before firing the next request.
     * @param  {Boolean} isRandom Whether or not the thinktime should be randomized.
     *                            If set to true, the thinktime will have a mean of `seconds`.
     */
    that.think = function(seconds, isRandom) {
        isRandom = isRandom || true;
        actions.push(new ThinkTime(seconds, isRandom));
    };

    that.to_xml = function() {
        var xml = '';
        xml += util.format('<session name="%s" probability="%d" type="ts_http">', name, probability);
        // Do dynamic variable stuff (files)
        
        // List transactions.
        for (var i = 0; i < actions.length; i++) {
            xml += actions[i].to_xml();
        }

        xml += '</session>';
        return xml;
    };

    return that;
};

var ThinkTime = function(seconds, isRandom) {
    var that = {};
    that.seconds = seconds;
    that.isRandom = isRandom;

    that.to_xml = function() {
        return util.format('<thinktime value="%d" random="%s"/>', that.seconds, that.isRandom);
    };

    return that;
};

var Transaction = function(name) {
    var requests = [];
    var that = {};
    that.name = name;

    /**
     * Add a request to this transaction.
     * @param {String} method  An HTTP Method
     * @param {String} url     The absolute path to fire the request to
     * @param {Object} data    An optional data object if you're POSTing data
     */
    that.addRequest = function(method, url, data) {
        data = data || {};
        var request = new Request(method, url, data);
        requests.push(request);
        return request;
    };


    that.to_xml = function() {
        var xml = util.format('<transaction name="tx_%s">', name);
        for (var i = 0; i < requests.length;i++) {
            var request = requests[i];
            xml += request.to_xml();
        }
        
        xml += '</transaction>';
        return xml;
    };

    return that;
};

var Request = function(method, url, data) {
    var variables = [];
    var that = {};

    /**
     * Allows capturing of some response data in a variable.
     * @param {String} name       The variable name.
     * @param {String} type       The variable type.
     *                            One of `json`, `xpath`, `regexp`, `re`, `psql`
     * @param {String} expression A valid expression to capture data.
     */
    that.addDynamicVariable = function(name, type, expression) {
        variables.push(new DynamicVariable(name, type, expression));
    }

    that.to_xml = function() {
        var xml = util.format('<request subst="%s">', (variables.length > 0));

        // Capture a part of the response in a variable (if required)
        for (var i = 0 ; i < variables.length; i++) {
            xml += variables[i].to_xml();
        }

        if (method === 'POST') {
            var contents = querystring.stringify(data, '&amp;');
            xml += util.format('<http url="%s" method="%s" version="1.1" contents="%s" />', url, method, contents);
        } else {
            xml += util.format('<http url="%s" method="%s" version="1.1" />', url, method);
        }
        xml += '</request>';
        return xml;
    };
    return that;
};

var DynamicVariable = function(name, type, expression) {
    var attr = '';
    if (type === 'json') {
        attr = 'jsonpath';
    } else if (type === 'xpath') {
        attr = 'xpath';
    } else if (type === 'regexp') {
        attr = 'regexp';
    } else if (type === 're') {
        attr = 're';
    } else if (type === 'psql') {
        attr = 'pgsql_expr';
    }
    var that = {};
    that.to_xml = function() {
        return util.format('<dyn_variable name="%s" %s="%s"/>', name, attr, expression);
    };
    return that;
};