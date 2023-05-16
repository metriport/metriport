// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

// This type of array only works properly if items are only added using push and are never deleted, reassigned, or changed using another method.
function makeCoverageArray() {
  var array = [];
  array.accessed = [];
  array.repeats = [];

  array.push = function (...items) {
    var index = this.length;
    items.forEach(
      function (item) {
        var curIndex = index;
        Object.defineProperty(array, curIndex, {
          get: function () {
            this.accessed[curIndex] = true;
            return item;
          },
        });

        this.accessed[curIndex] = false;
        this[curIndex] = item;

        index++;
      }.bind(this)
    );
  };

  return array;
}

function makeUndefinedAccessReporterArray(name, line) {
  var handler = {
    get: function (obj, prop) {
      if (prop in obj) {
        return obj[prop];
      } else {
        if (
          !(typeof prop === "symbol" && JSON.stringify(prop) === undefined) &&
          Number.isInteger(parseInt(prop, 10))
        ) {
          obj.undefinedFieldsAccessed.push(prop);
        }
        return undefined;
      }
    },
  };

  const array = new Proxy([], handler);
  array.undefinedFieldsAccessed = [];
  array.name = name;
  array.line = line;

  return array;
}

module.exports.makeCoverageArray = makeCoverageArray;
module.exports.makeUndefinedAccessReporterArray = makeUndefinedAccessReporterArray;
