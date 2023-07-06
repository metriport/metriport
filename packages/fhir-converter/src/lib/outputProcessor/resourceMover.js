// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var constants = require("../constants/constants");

module.exports.Process = function (jsonObj, replacementDictionary) {
  try {
    var jsonObjClone = JSON.parse(JSON.stringify(jsonObj));
    let movedResources = moveObjects(jsonObjClone.entry, replacementDictionary);
    jsonObjClone.entry = jsonObjClone.entry.concat(movedResources);
    return jsonObjClone;
  } catch (err) {
    return jsonObj;
  }
};

function moveObjects(obj, replacementDictionary) {
  let movedResourcesList = [];
  for (var prop in obj) {
    if (typeof obj[prop] === "object") {
      movedResourcesList = movedResourcesList.concat(moveObjects(obj[prop], replacementDictionary));
      if (
        Object.prototype.hasOwnProperty.call(obj[prop], constants.MOVE_TO_GLOBAL_KEY_NAME) &&
        Object.prototype.hasOwnProperty.call(obj[prop], "resource")
      ) {
        delete obj[prop][constants.MOVE_TO_GLOBAL_KEY_NAME];
        movedResourcesList.push(replaceText(obj[prop], replacementDictionary));
        delete obj[prop];
      }
    }
  }
  return movedResourcesList;
}

module.exports.ReplaceText = function (jsonObj, replacementDictionary) {
  return replaceText(jsonObj, replacementDictionary);
};

function replaceText(jsonObj, replacementDictionary) {
  if (replacementDictionary) {
    var outputLines = JSON.stringify(jsonObj, null, 2)
      .replace(/(?:\r\n|\r|\n)/g, "\n")
      .split("\n");
    var substitutionRegEx = /"\$([0-9]+)\$":/;
    for (var i = 0; i < outputLines.length; i++) {
      var subMatch = outputLines[i].match(substitutionRegEx);
      if (subMatch && subMatch.length > 0) {
        outputLines[i] = outputLines[i].replace(
          substitutionRegEx,
          replacementDictionary[subMatch[0]]
        );
      }
    }
    return JSON.parse(outputLines.join(" "));
  }
  return jsonObj;
}
