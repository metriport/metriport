// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const unescapeRegex = /(\\)(F|S|E|T|R|.br|X[0-9A-F]+)(\\)/g;

module.exports.Unescape = function (
  input,
  fieldSeparator,
  componentSeparator,
  subcomponentSeparator,
  repetitionSeparator
) {
  function unescaper(match, p1, p2) {
    switch (p2) {
      case "F":
        return fieldSeparator;
      case "S":
        return componentSeparator;
      case "T":
        return subcomponentSeparator;
      case "R":
        return repetitionSeparator;
      case "E":
        return `\\`;
      case ".br":
        return `\\n`;
      default:
        return handleHex(p2);
    }
  }

  function handleHex(hexStr) {
    let result = "";
    for (let i = 1; i < hexStr.length - 1; i += 2) {
      let twoCharStr = hexStr.slice(i, i + 2);
      result = result.concat(String.fromCharCode(parseInt(twoCharStr, 16)));
    }
    return result;
  }

  return input.replace(unescapeRegex, unescaper);
};
