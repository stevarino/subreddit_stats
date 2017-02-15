/**************************************************************************
 * Reddit API
 * Stephen O'Connor
 * 
 * February 13th, 2017
 * 
 * A bare-bones module to handle GET requests to the Reddit API. Handles
 * authentication with automatic renewal. 
 */

"use strict";
var https = require('https');
var qs = require('querystring');
var fs = require('fs');
var assert = require('assert');
var C = require('./common');

var ACTIVE_TOKEN = "";
var REDDIT_IS_READY = false;
var TOKEN_TIMER;

var USER_AGENT;
var AUTH_HEADER;
var SETTINGS = {};

// overwritten by import
var log = console.log;

const CONSTS = {
  ERR_NOT_READY: "Reddit API is not ready.",
  ERR_SERVER: "The server returned an error.",
  ERR_JSON_PARSE: "The JSON returned was invalid."
};

for(var k in CONSTS) {
  exports[k] = CONSTS[k];
}

/**
 * Initializes the Reddit API, returns a Promise from set_token. 
 * 
 * Requires a settings object with the following keys:
 *    client_id - the reddit  app's client id as defined under the reddit account
 *    secret    - the secret key given by reddit for the app
 *    username  - reddit username
 *    password  - reddit password
 *    version   - version of current app.
 *    timeout   - time to wait in ms on server error.
 */
exports.init = function(settings={}) {
  var keys = ['client_id', 'secret', 'username', 'password', 'version', 
              'timeout'];
  for (var k in keys) {
    assert(keys[k] in settings, `Settings object missing ${keys[k]}.`);
    SETTINGS[keys[k]] = settings[keys[k]];
  }
  return set_token();
}

/**
 * Closes any active timers.
 */
exports.quit = function() {
  log("Reddit API shutting down. Cancelling timer ");
  clearTimeout(TOKEN_TIMER);
}

/**
 * Allows settinga custom log function.
 */
exports.set_log = function(new_log) {
  log = new_log;
}

/**
 * Sets the global ACTIVE_TOKEN variable (async)
 */
function set_token() {
  // curl 
  //   -X POST 
  //   -d 'grant_type=password&username=reddit_bot&password=snoo' 
  //   --user 'p-jcoLKBynTLew:gko_LXELoV07ZBNUXrvWZfzE3aI' 
  //   https://www.reddit.com/api/v1/access_token
  REDDIT_IS_READY = false;

  AUTH_HEADER = 'Basic ' + new Buffer(SETTINGS.client_id + ':' 
      + SETTINGS.secret).toString('base64');
  USER_AGENT = 'subreddit_stats/' + SETTINGS.version + ' by ' 
      + SETTINGS.client_id;

  var post_data = {
    'grant_type': 'password',
    'username': SETTINGS.username,
    'password': SETTINGS.password,
  };
  post_data = qs.stringify(post_data);

  var post_options = {
    'method': 'POST',
    'host': 'www.reddit.com',
    'path': '/api/v1/access_token',
    'headers': {
      'User-Agent': USER_AGENT, 
      'Authorization': AUTH_HEADER, 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(post_data)
    }
  }
  log("Updating Reddit auth token...");
  var promise = new Promise((resolve, reject) => {
    var post_req = https.request(post_options, (res) => {
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        var res_data = JSON.parse(chunk);

        if (!('access_token' in res_data)) {
          var f = C.save_object(res_data);
          log("Did not receive auth token. File saved to "+f)
          return reject();
        }

        ACTIVE_TOKEN = res_data.access_token;
        REDDIT_IS_READY = true;
        TOKEN_TIMER = setTimeout(set_token, 1000 * (res_data.expires_in - 30));
        log("Reddit auth token: " + ACTIVE_TOKEN + " (" + 
            res_data.expires_in + "s)");
        resolve();
      });
    });
    post_req.write(post_data);
    post_req.end();
  });
  return promise;
}

/**
 * Performs a basic Reddit API get request.
 * 
 * callback should expect (error, response) arguments. The response object
 * will have the following fields: 
 *    status (int) http status code
 *    headers (array) list of http headers
 *    request (object) values sent to reddit
 *    content (object/string) response body from reddit. Note: will be 
 *                parsed as json, but if an error occurs the raw string will 
 *                be returned.
 *    error (Error, optional) Any errors encountered while parsing the json.
 */
exports.get = function(options={}, callback=null) {
  // curl 
  //  -H "Authorization: bearer J1qK1c18UUGJFAzz9xnH56584l4" 
  //  -A "ChangeMeClient/0.1 by YourUsername" 
  //  https://oauth.reddit.com/api/v1/me
  
  if (!callback) {
    callback = (err, data) => {
      log(JSON.stringify(data, null, 2));
    };
  }

  if (!REDDIT_IS_READY) {
    return callback(CONSTS.ERR_NOT_READY, null);
  }

  var defaults = {
    'method': 'GET',
    'host': 'oauth.reddit.com',
    'path': '/api/v1/me',
    'headers': {
      'User-Agent': USER_AGENT, 
      'Authorization': "bearer " + ACTIVE_TOKEN
    }
  }

  // weird bug where reddit issues a 500 just before a token update
  // old credentials can be hanging out - no bueno.
  if ('headers' in options && 'Authorization' in options.headers) {
    delete options.headers.Authorization;
  }
  
  C.merge_objects(options, defaults);
  
  https.get(options, (res) => {
    res.setEncoding('utf8');
    var builder = [];
    var response = {
      request: options
    };
    res.on('data', (chunk) => {
      builder.push(chunk);
    });
    res.on('end', () => {
      var json = builder.join('');
      response.status = res.statusCode;
      response.headers = res.headers;

      if (response.headers["content-type"] == 'text/html' || 
          response.status >= 500) {
        log("Reddit is overloaded - waiting");
        REDDIT_IS_READY = false;
        setTimeout(() => {
          log("Recommencing request");
          REDDIT_IS_READY = true;
        }, SETTINGS.timeout);
        return callback(CONSTS.ERR_SERVER, response);
      }

      try {
        response.content = JSON.parse(json);
      } catch (err) {
        response.content = json;
        response.error = err;
        return callback(CONSTS.ERR_JSON_PARSE, response);
      }
      callback(null, response);
    });
  });
}