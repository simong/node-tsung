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


var tsung = require('./lib/index.js');


var config = {
    'loglevel': 'notice',
    'version': '1.0',
    'dumpTraffic': false
};

// A simple runner that tests a server running on localhost:2001
var runner = new tsung.Tsung(config);
runner.addClient('localhost', true, 10000);
runner.addServer('localhost', '2001');

// 4 phases of each 5 minutes where the users that get added
// per second increases exponentially.
runner.addPhase(5, 'minute', 1, 'second');
runner.addPhase(5, 'minute', 2, 'second');
runner.addPhase(5, 'minute', 4, 'second');
runner.addPhase(5, 'minute', 8, 'second');






// The underlying logic can be abstracted into APIs.
// Create a new session.
var session = runner.addSession('my_profile');

// The user logs in and goes straight to the dashboard page.
var loginTransaction = session.addTransaction('login');
loginTransaction.addRequest('POST', '/api/auth/login', {'username': '%%_users_username%%', 'password': '%%_users_password%%'});
var dashboardTransaction = session.addTransaction('dashboard');
var me = dashboardTransaction.addRequest('GET', '/api/me');
me.addDynamicVariable('me_user_id', 'json', '$.id');


// When he hits the dashboard he waits for a bit.
session.think(5);




// Start the test.
//runner.run();
console.log(runner.to_xml());