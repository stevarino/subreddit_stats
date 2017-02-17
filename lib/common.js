/**************************************************************************
 * JSON Mason
 * Stephen O'Connor
 * 
 * February 13th, 2017
 * 
 * Common utility functions. 
 */
"use strict";
var fs = require('fs');


/**
 * save_object
 * Saves a stringified Javascript object into a text file. 
 * 
 * WARNING: Naive implementation - does not handle recursion or deeply 
 * nested objects.
 */
exports.save_object = function(obj, filename=null) {
  if (!filename) {
    filename = 'data/'+String(Date.now())+'.txt';
  }
  if (typeof(obj) == 'object') {
    obj = JSON.stringify(obj, null, 2);
  }
  fs.writeFileSync(filename, obj);
  return filename;
}

/**
 * merge_objects
 * Takes two objects and updates the first with
 * any new fields found in the second.
 * 
 * Recursively merges any shared objects.
 * 
 * Does not merge arrays.
 */
exports.merge_objects = function(a, b) {
  for (var key in b) {
    if (!(key in a)) {
      a[key] = b[key];
    } else if (typeof(b[key]) == 'object' 
        && typeof(a[key]) == 'object') {
      exports.merge_objects(a[key], b[key]);
    }
  }
}

/**
 * log
 * Prepends a timestamp before the log. Note: Does not handle default 
 * console.log string formatting. 
 */
exports.log = function() {
  var lp = exports.left_pad;
  var d = new Date();
  var s = `${lp(d.getHours())}:${lp(d.getMinutes())}:${lp(d.getSeconds())} `;
  console.log(s, ...arguments)
}

/**
 * left_pad
 * Pads a string with the given character until the string is the desired
 * length.
 */
exports.left_pad = function(str, len=2, c='0') {
  if (typeof(str) != "string") {
    str = String(str);
  }
  if (str.length < len) {
    return Array((len-str.length)/c.length+1).join(c)+str;
  }
  return str;
  var arr = str.split('').reverse();
  while (arr.length < len) {
    arr.push(c);
  }
  return arr.reverse().join('');
}