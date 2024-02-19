// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
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
        if (hasEmptyResourceFilter(item)) continue;
        if (hasEmptyResourceFilterText(item)) continue;

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

function hasEmptyResourceFilter(item) {
  const resource = item.resource;
  if (!resource) return false;

  const keys = Object.keys(resource);
  const hasMeta = keys.includes("meta");
  const hasId = keys.includes("id");
  const hasIdentifier = keys.includes("identifier");

  if ((hasMeta && hasId && keys.length === 3) ||
      (hasId && keys.length === 2) ||
      (hasMeta && hasIdentifier && hasId && keys.length === 4)) {
    return true; // Matches the dead resource criteria, should be filtered out
  }

  return false; // Does not match the criteria, should not be filtered out
}

function hasEmptyResourceFilterText(item) {
  const resource = item.resource;
  if (!resource) return false;

  const fieldsToCheck = ["vaccineCode", "code", "reasonCode"];
  const noPhrases = [
    "no known", "no observation", "no data", "no information", 
    "no results", "no medical", "no smoking status", "no social history", 
    "no chronic problems"
  ];

  for (let field of fieldsToCheck) {
    if (resource[field] && resource[field].text) {
      const textLower = resource[field].text.toLowerCase();
      if (noPhrases.some(phrase => textLower.includes(phrase))) {
        return true; // Found a dead response, should be filtered out
      }
    }
  }

  return false; // No dead response found, should not be filtered out
}

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
