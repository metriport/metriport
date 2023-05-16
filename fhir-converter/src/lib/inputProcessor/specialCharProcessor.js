// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

let escapeRegex = /(\\|")/g;
let unescapeRegex = /(\\)(\\|")/g;

module.exports.Escape = function (input) {
  return input.replace(escapeRegex, escaper);
};

module.exports.Unescape = function (input) {
  return input.replace(unescapeRegex, unescaper);
};

function escaper(match, p1) {
  return `\\${p1}`;
}

function unescaper(match, p1, p2) {
  return `${p2}`;
}
