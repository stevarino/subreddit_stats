/**************************************************************************
 * JSON Mason
 * Stephen O'Connor
 * 
 * February 13th, 2017
 * 
 * A simple HTTP server built around a JSON Rest interface. This will 
 * hopefully seperated into it's own project and greatly expanded in the 
 * very near future.
 */

var http = require('http');
var url = require('url');

const API = http.createServer(route);
var ROUTES = [];

/**
 * init
 * Establishes the server on the dcorrect port.
 */
exports.init = function(port, routes=[], callback) {
  if (callback === undefined) {
    callback = (err) => {if (err) throw err;}
  }

  add_routes(routes);

  return new Promise((resolve, reject) => {
    API.listen(port, ()=> {
      resolve();
    });
  });
}

/**
 * Routes requests and sets initial variables.
 */
function route(req, res) {
  var req_obj = {
    request: req,
    response: res,
    url: url.parse(req.url, true),
    get_arguments: {},
    url_arguments: []
  }

  req_obj.get_arguments = req_obj.url.query;
  var path = req_obj.url.pathname;

  for (var i in ROUTES) {
    var route = ROUTES[i];
    if ('url' in route && route.url == path) {
      return handle_reponse(res, route.callback(req_obj));
    } else if ('pattern' in route && route.pattern.test(path)) {
      req_obj.url_arguments = route.pattern.exec(path);
      return handle_reponse(res, route.callback(req_obj));
    }
  }
  send_response_string(res, 404, "404/Not found.");
}

function handle_reponse(http_res, response) {
    // false indicates that the callback handled it.
    if (response === false) return;

    // did we receive a promise? if so, get recursive.
    if (typeof(response.then) == 'function') {
      return response.then(
        (promise_response) => {
          handle_reponse(http_res, promise_response);
        }, 
        (err) => {
          if (typeof(err) == 'object') {
            err = JSON.stringify(err, null, 2);
          }
          var body = 'HTTP 500\n\n' + String(err);
          return send_response_string(http_res, 500, body);
        }
      );
    }
    
    var content =  JSON.stringify(response, null, 2);
    send_response_string(http_res, 200, content);
}

function send_response_string(http_res, status, body) {
    http_res.writeHead(status, {
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': 'text/plain', 
      'Connection': 'close'
    });
    http_res.end(body);
}

function add_routes(routes) {
  for (var i in routes) {
    if (typeof(routes[i][0]) === 'string') {
      ROUTES.push({
        url: routes[i][0],
        callback: routes[i][1]
      });
    } else if (routes[i][0].hasOwnProperty('test')) {
      ROUTES.push({
        pattern: routes[i][0],
        callback: routes[i][1]
      });
    } else {
      throw new TypeError("Invalid route.")
    }
  }
}

exports.quit = function quit(callback) {
    API.close(callback);
}