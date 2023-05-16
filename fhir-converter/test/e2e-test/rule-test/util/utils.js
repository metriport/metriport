// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const countOccurences = (arr, value) => arr.reduce((a, v) => (v === value ? a + 1 : a + 0), 0);
const defaultGuid = "4cfe8d6d-3fc8-3e41-b921-f204be18db31"; // pass the parameter 'undefined'

var findDuplicates = function (arr) {
  var dict = {};
  var result = [];
  arr.forEach(function (elem) {
    if (dict[elem] !== undefined) dict[elem] += 1;
    else dict[elem] = 1;
  });
  for (var key in dict) {
    if (dict[key] > 1) result.push(key);
  }
  return result;
};

module.exports = {
  countOccurences: countOccurences,
  defaultGuid: defaultGuid,
  findDuplicates: findDuplicates,
};
