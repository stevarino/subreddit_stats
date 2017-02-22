/**************************************************************************
 * Subreddit Stats
 * Stephen O'Connor
 * 
 * February 13th, 2017
 * 
 * A project to gather activity statistics over time of given subreddits 
 * and gather them into a sqlite database. 
 * 
 * (Also my first node.js project...)
 */

"use strict";
var readline = require('readline');
var fs = require('fs');
var sqlite3 = require('sqlite3').verbose();
var reddit_api = require('./lib/reddit_api');
var http_api = require('./lib/json_mason/json_mason');

// common helper functions
var C = require("./lib/common")

const VERSION = '0.0.2';
const BUILD = 2;

var DB = new sqlite3.Database('db.sqlite3');

// interval timer for reddit api
var SUBSCRIPTION_TIMER;
// rate limit is 60 req/min - 1100 is 95% of that rate.
var SUBSCRIPTION_INTERVAL = 1100;

// queue of subs to query.
var SUB_LIST = [];
var SUB_INDEX = -1;

// subs that are skipped (blacklisted or inaccessable)
// recording sub name here to avoid modifying sub_list 
// while iterating. 
var SKIPPED_SUBS = [];

// http json control/monitoring api
var API_ROUTES = [
  ['/', (req) => {
    return {
      status_url: '/status',
      settings_url: '/settings',
      quit_url: '/quit'
    };
  }], 
  ['/status', http_status],
  ['/settings', http_settings],
  ['/quit', http_quit]
];

// available database updates. executed in order.
var UPDATES = [
  db_update_add_last_call
]

/**
 * startup
 * 
 * Sets up everything (Reddit API, Control API, Database)
 */
function startup() {
  var data = fs.readFileSync('settings.json', {encoding: 'utf8'});
  var settings = JSON.parse(data);

  SUBSCRIPTION_INTERVAL = settings.app.request_interval_ms;

  http_api.init(settings.app.port, API_ROUTES).then(() => {
    C.log(`HTTP Server running on port ${settings.app.port} with ` 
          + `${API_ROUTES.length} routes.`);
  });

  sqlite_init().then(()=> {
    C.log('sqlite initialized');
    DB.get(`SELECT value FROM settings WHERE key='version'`, (err, row)=> {
      C.log("Database version: ", row.value);
    });
    C.log("Number of rows: ", SUB_LIST.length);

    reddit_api.set_log(C.log);
    reddit_api.init({
      client_id: settings.reddit.client_id,
      secret: settings.reddit.secret,
      username: settings.reddit.username,
      password: settings.reddit.password,
      version: VERSION,
      timeout: settings.app.server_error_timeout_ms
    }).then(scan_subreddits).catch(could_not_authenticate);
  });
}

/**
 * could_not_authenticate
 * 
 * The reddit api could not authenticate. Log the message for now.
 */
function could_not_authenticate() {
  C.log("ERROR [API]: Could not authenticate with reddit. ", ...arguments);
}

/**
 * scan_subreddits 
 * 
 * Main worker function - establishes statements and intervals for Reddit API
 * calls.
 */
function scan_subreddits() {
  C.log('Beginning scan');

  var fields = ['subscribers', 'accounts_active', 'public_traffic', 'created_utc', 
                'quarantine', 'accounts_active_is_fuzzed'];

  var insert = DB.prepare(`INSERT INTO sub_info 
                                (sub_id, timestamp, ${fields.join(', ')}) 
                          VALUES (?, ?${Array(fields.length+1).join(', ?')});`);
  
  SUBSCRIPTION_TIMER = setInterval(() => {
    if (SUB_INDEX == -1) {
      C.log('Database not ready. Waiting...');
      return;
    }

    let row = SUB_LIST[SUB_INDEX];
    SUB_INDEX = (SUB_INDEX + 1) % SUB_LIST.length;
    
    if (SKIPPED_SUBS.indexOf(row.name) > -1) {
      return;
    }

    try { // not happy about the scope of this, but it needs to be bulletproof.
      reddit_api.get({'path': `/r/${row.name}/about`}, (err, response) => {
        if (err) {
          if (err === reddit_api.ERR_JSON_PARSE) {
            var f = C.save_object(response);
            C.log("ERROR [JSON]: Could not parse response. Data saved to ", f);
          } else if (err === reddit_api.ERR_NOT_READY 
                      || err === reddit_api.ERR_SERVER) {
            // pass
          } else {
            C.log("ERROR [API]:", err);
          }
          return;
        }

        var values = [row.id, Date.now()];

        // banned subs
        if ('error' in response.content && response.content.error == 404) {
          C.log(`Sub ${row.name} returned 404, setting to inactive`);
          DB.run(`UPDATE subs SET is_active = 0 WHERE id = ${row.id}`);
          SKIPPED_SUBS.push(row.name);
          return;
        }

        for (var i in fields) {
          try {
            values.push(response.content.data[fields[i]]);
          } catch (err) {
            var filename = C.save_object(response);
            throw new Error (
              `Missing field ${fields[i]}. Object saved to ${filename}`);
          }
        }

        insert.run(values);
      });
    } catch(exc) {
      C.log("ERROR [EXCEPTION]: ", exc)
    }
  }, SUBSCRIPTION_INTERVAL);
}

/**
 * sqlite_init
 * 
 * Creates database if needed by defining tables and iniitial settings.
 */
function sqlite_init() {
  return new Promise((resolve, reject) => {
    DB.serialize(() => {
      DB.get(`SELECT name FROM sqlite_master 
              WHERE type='table' AND name='settings'`, (err, row) => {
        if (err) throw err;
        if (row === undefined) {
          // blank database - setup.
          var create = `CREATE TABLE settings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            key TEXT UNIQUE,
                            value TEXT
                        );`;
          var version = `INSERT INTO settings (key, value) VALUES ('version', ?)`;
          var build = `INSERT INTO settings (key, value) VALUES ('build', ?)`;

          var subreddit_table = `CREATE TABLE subs (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    name TEXT UNIQUE,
                                    is_active INTEGER DEFAULT 1
                                  );`
          var subreddit_info = `CREATE TABLE sub_info (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    sub_id INTEGER,
                                    timestamp INTEGER,
                                    subscribers INTEGER,
                                    accounts_active INTEGER,
                                    public_traffic INTEGER,
                                    created_utc INTEGER,
                                    quarantine INTEGER,
                                    accounts_active_is_fuzzed INTEGER
                                  );`
          var subreddit_index = `CREATE INDEX subs_index ON subs(name);`

            db_run_func(create, [])()
              .then(db_run_func(version, VERSION))
              .then(db_run_func(build, 1))
              .then(db_run_func(subreddit_table))
              .then(db_run_func(subreddit_index))
              .then(db_run_func(subreddit_info))
              .then(load_database)
              .then(update_database)
              .then(load_subreddits)
              .then(resolve);
        } else {
          load_database()
              .then(update_database)
              .then(load_subreddits)
              .then(resolve);
        }
      });
    });
  });
}

/**
 * load_database
 * 
 * Update database with contents of subs.txt
 */
function load_database() {
  return new Promise((resolve, reject) => {
    var comment = /^\s*#/
    var stmt = DB.prepare("INSERT INTO subs (name) VALUES (?)");

    var list = readline.createInterface({
      input: fs.createReadStream('subs.txt')
    });
    
    list.on('line', (line) => {
      if (comment.test(line) || ! line.trim()) return;

      stmt.run(line.trim(), (err) => {
        if (err && ! err.message.startsWith('SQLITE_CONSTRAINT: UNIQUE')) {
          throw err;
        }
      });
    });
    list.on('close', () => {
      stmt.finalize();
      resolve();
    });
  });
}

/**
 * update_database
 * 
 * Updates the database to the current build number. First call it returns
 * a callback and begins recursively applying updates. The promise is 
 * resolved on successful application of all updates and rejected if 
 * any update fails.
 */
function update_database(build = 0) {
  if (build == 0) {
    return new Promise ((resolve, reject) => {
      db_get("SELECT value FROM settings WHERE key='build'").then((row) => {
        update_database(parseInt(row.value), resolve, reject);
      });
    });
  }
  var resolve = arguments[1];
  var reject = arguments[2];

  if (build > UPDATES.length) {
    return resolve();
  }
  
  C.log('UPDATING to build ', build);
  
  UPDATES[build-1]().then(() => {
    update_database(build+1, resolve, reject);
  }).catch(err => {
    reject(err);
  });
}

function load_subreddits() {
  return new Promise((resolve, reject) => {
    var select = `SELECT subs.id, subs.name, Max(sub_info.timestamp) as ts
                FROM subs LEFT JOIN sub_info ON sub_info.sub_id = subs.id 
                WHERE subs.is_active = 1
                GROUP BY subs.id, subs.name 
                ORDER BY ts IS NOT NULL ASC, ts ASC, subs.id asc;`;
    DB.all(select, (err, rows) => {
      if (err) reject("Unable to retrive subs list");
      SUB_LIST = rows;
      SUB_INDEX = 0;
      resolve();
    });
    SUB_LIST
  })
}

function db_update_add_last_call() {
  return new Promise((resolve, reject) => {
    db_run_func(`INSERT INTO settings (key, value) VALUES ('last_query', 0)`)()
      .then(db_run_func("UPDATE settings SET value = 2 WHERE key='build'"))
      .then(resolve());
  });
}

/**
 * db_run_func
 * 
 * Convenience function that converts sqlite3.run to a callable promise.
 * 
 * Modified from https://github.com/mozilla/promise-sqlite
 */
function db_run_func(sql, params) {
  return () => {
    return new Promise((resolve, reject) => {
      DB.run(sql, params, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * db_get
 * 
 * Convenience function that converts sqlite3.get to a promise.
 */
function db_get(sql, params) {
  return new Promise((resolve, reject) => {
    DB.get(sql, params, (err, row) => {
      if (err) {
        reject({sql: sql.split('\n'), params: params, err: err});
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * http_status
 * 
 * Returns the status json object.
 */
function http_status(request) {
  return new Promise((resolve, reject) => {
    Promise.all([
      db_get(`SELECT COUNT(*) as cnt FROM sub_info`),
      db_get(`SELECT subs.name AS name, 
                DateTime(timestamp/1000,'unixepoch','localtime') AS dt,
                sub_info.accounts_active, sub_info.subscribers 
              FROM sub_info 
                INNER JOIN subs ON subs.id = sub_info.sub_id
              ORDER BY sub_info.id DESC LIMIT 1`)
    ]).then(values => {
      resolve({
        total_records: values[0].cnt,
        last_check: {
          name: values[1].name, 
          datetime: values[1].dt,
          accounts_active: values[1].accounts_active,
          subscribers: values[1].subscribers
        }
      });
    }).catch(err => {
      reject(err);
    });
  });
}

/**
 * http_settings
 * 
 * Returns the current settings in the database
 */
function http_settings(request) {
  return new Promise((resolve, reject) => {
    DB.all("SELECT key, value FROM settings", (err, rows) => {
      if (err) return reject(err);
      var settings = {};
      for (var i in rows) {
        settings[rows[i].key] = rows[i].value;
      }
      resolve({settings: settings});
    });
  });
}


/**
 * http_settings
 * 
 * Gracefully shuts down the reddit and http api's.
 * 
 * NOTE: If the http api has any open connections, the http server will 
 * wait until the connections are closed.
 */
function http_quit(req) {
  C.log("/quit called.");
  reddit_api.quit();
  clearInterval(SUBSCRIPTION_TIMER);
  http_api.quit(() => {
    C.log("HTTP API server shut down.");
  });
  return {
    status: 'quitting'
  };
}

startup();