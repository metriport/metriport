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

var deepmerge = require("deepmerge");
var underscore = require("underscore");
var crypto = require("crypto");
var resMover = require("./resourceMover");

module.exports.Process = function (jsonObj, replacementDictionary) {
  try {
    let mergedEntry = [];
    let resourceKeyToIndexMap = {};

    if (Object.prototype.hasOwnProperty.call(jsonObj, "entry")) {
      for (var item of jsonObj.entry) {
        let resourceKey = getKey(item);
        if (Object.prototype.hasOwnProperty.call(resourceKeyToIndexMap, resourceKey)) {
          let index = resourceKeyToIndexMap[resourceKey];
          mergedEntry[index] = merge(
            resMover.ReplaceText(mergedEntry[index], replacementDictionary),
            resMover.ReplaceText(item, replacementDictionary)
          );
        } else {
          mergedEntry.push(item);
          resourceKeyToIndexMap[resourceKey] = mergedEntry.length - 1;
        }
      }

      delete jsonObj.entry;
      jsonObj["entry"] = mergedEntry;
    }

    return jsonObj;
  } catch (err) {
    return jsonObj;
  }
};

function merge(r1, r2) {
  const merged = deepmerge(r1, r2, {
    arrayMerge: concatAndDedup,
  });
  return merged;
}

const concatAndDedup = (target, source) => {
  let destination = target.concat(source);
  destination = underscore.uniq(destination, false, function (item) {
    return crypto.createHash("md5").update(JSON.stringify(item)).digest("hex");
  });
  return destination;
};

function getKey(res) {
  if (
    Object.prototype.hasOwnProperty.call(res, "resource") &&
    Object.prototype.hasOwnProperty.call(res.resource, "resourceType")
  ) {
    let key = res.resource.resourceType;
    if (Object.prototype.hasOwnProperty.call(res.resource, "meta")) {
      if (Object.prototype.hasOwnProperty.call(res.resource.meta, "versionId")) {
        key = key.concat("_", res.resource.meta.versionId);
      }
    }
    if (Object.prototype.hasOwnProperty.call(res.resource, "id")) {
      key = key.concat("_", res.resource.id);
    }
    //console.log(`getkey: ${key}`);
    return key;
  }
  return JSON.stringify(res);
}
