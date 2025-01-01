// -------------------------------------------------------------------------------------------------
// Copyright (c) 2022-present Metriport Inc.
//
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//     Copyright (c) Microsoft Corporation. All rights reserved.
//
//     Permission to use, copy, modify, and/or distribute this software
//     for any purpose with or without fee is hereby granted, provided
//     that the above copyright notice and this permission notice appear
//     in all copies.
//
//     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
//     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
//     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
//     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
//     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
//     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
//     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
//     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
// -------------------------------------------------------------------------------------------------

var Promise = require("promise");
var memCache = require("memory-cache").Cache;
var fs = require("fs");
var path = require("path");
var errorCodes = require("../error/error").errorCodes;
var errorMessage = require("../error/error").errorMessage;

const CACHED = "cached";
const ACTUAL = "actual";

module.exports = class fsCache {
  constructor(path) {
    this._cache = new memCache();
    this._versions = {};
    this._path = path;
    this._empty = true;
  }

  keys() {
    //console.log(`keys`);
    let cache = this._cache;
    return new Promise((fulfill, reject) => {
      this.init()
        .then(() => fulfill(cache.keys()))
        .catch(err => reject(err));
    });
  }

  has(key) {
    //console.log(`has ${key}`);
    let cache = this._cache;
    return new Promise((fulfill, reject) => {
      this.init()
        .then(() => {
          if (cache.keys().includes(key)) {
            fulfill(true);
          } else {
            fulfill(false);
          }
        })
        .catch(err => reject(err));
    });
  }

  get(key) {
    //console.log(`get ${key}`);
    let cache = this._cache;
    let versions = this._versions;

    return new Promise((fulfill, reject) => {
      this.init().then(() => {
        if (cache.keys().includes(key)) {
          if (versions[key][CACHED] !== versions[key][ACTUAL]) {
            //console.log(`get ${key} : cache miss`);
            let version = versions[key][ACTUAL];
            let filePath = path.join(this._path, key);

            fs.readFile(filePath, (err, content) => {
              if (err) {
                reject(errorMessage(errorCodes.NotFound, `${key} not found`));
              } else {
                cache.put(key, content);
                versions[key][CACHED] = version;
                fulfill(content);
              }
            });
          } else {
            fulfill(cache.get(key));
          }
        } else {
          reject(errorMessage(errorCodes.NotFound, `${key} not found`));
        }
      });
    });
  }

  set(key, value) {
    //console.log(`set ${key}`);
    let cache = this._cache;
    let versions = this._versions;

    return new Promise((fulfill, reject) => {
      this.init().then(() => {
        let fullFileName = path.join(this._path, key);
        fs.mkdir(path.dirname(fullFileName), { recursive: true }, err => {
          // For some versions, mkdir throws EEXIST even if recursive:true is passed, which can be ignored here.
          if (err && err.code !== "EEXIST") {
            reject(errorMessage(errorCodes.WriteError, err.message));
          } else {
            fs.writeFile(fullFileName, value, function (err) {
              if (err) {
                reject(errorMessage(errorCodes.WriteError, `Unable to write ${key}`));
              } else {
                if (!cache.keys().includes(key)) {
                  versions[key] = { [CACHED]: 0, [ACTUAL]: 1 };
                  cache.put(key, undefined);
                }
                versions[key][ACTUAL]++;
                fulfill();
              }
            });
          }
        });
      });
    });
  }

  remove(key) {
    //console.log(`remove ${key}`);
    let cache = this._cache;
    let versions = this._versions;

    return new Promise((fulfill, reject) => {
      this.init().then(() => {
        fs.unlink(path.join(this._path, key), function (err) {
          if (err) {
            reject(errorMessage(errorCodes.NotFound, `Unable to find ${key}`));
          } else {
            cache.del(key);
            versions[key][ACTUAL]++;
            fulfill();
          }
        });
      });
    });
  }

  clear() {
    //console.log(`clear`);
    this._cache.clear();
    this._versions = {};
    this._empty = true;
  }

  init() {
    var walk = function (dir, done) {
      var results = [];
      fs.readdir(dir, { withFileTypes: true }, function (err, list) {
        if (err) return done(err);
        var i = 0;
        (function next() {
          var entry = list[i++];
          if (!entry) return done(null, results);

          if (!entry.name.startsWith(".")) {
            // avoid .git
            let file = dir + "/" + entry.name;
            if (entry.isDirectory()) {
              walk(file, function (err, res) {
                results = results.concat(res);
                next();
              });
            } else {
              results.push(file);
              next();
            }
          } else {
            next();
          }
        })();
      });
    };

    let cache = this._cache;
    let versions = this._versions;

    return new Promise((fulfill, reject) => {
      if (this._empty) {
        //console.log(`init`);
        walk(this._path, (err, files) => {
          if (err) {
            reject(errorMessage(errorCodes.NotFound, `Unable to access location ${this._path}`));
          } else {
            const prefix = this._path + "/";
            files
              .filter(f => f && f.length > prefix.length) // filter invalid entry caused by another write operations (e.g. UpdateBaseTemplate)
              .forEach(f => {
                let key = f.slice(prefix.length);
                versions[key] = { [CACHED]: 0, [ACTUAL]: 1 };
                cache.put(key, undefined);
              });
            this._empty = false;
            fulfill();
          }
        });
      } else {
        fulfill();
      }
    });
  }
};
