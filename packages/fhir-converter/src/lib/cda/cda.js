// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

let parseString = require("xml2js").parseString;
let dataHandler = require("../dataHandler/dataHandler");
const fs = require("fs");
let minifyXML = require("minify-xml");

module.exports = class cda extends dataHandler {
  constructor() {
    super("cda");
  }

  parseSrcData(data) {
    return new Promise((fulfill, reject) => {
      let minifiedData = minifyXML.minify(data, {
        removeComments: true,
        removeWhitespaceBetweenTags: true,
        considerPreserveWhitespace: true,
        collapseWhitespaceInTags: true,
        collapseEmptyElements: true,
        trimWhitespaceFromTexts: true,
        collapseWhitespaceInTexts: true, // this fixes the newline problem, but then doctor's notes look bad
        collapseWhitespaceInProlog: true,
        collapseWhitespaceInDocType: true,
        removeUnusedNamespaces: true,
        removeUnusedDefaultNamespace: true,
        shortenNamespaces: true,
        ignoreCData: true,
      });
      parseString(
        minifiedData,
        { trim: true, explicitCharkey: true, mergeAttrs: true, explicitArray: false },
        function (err, result) {
          if (err) {
            reject(err);
          }
          result._originalData = minifiedData;
          fulfill(result);
          // fs.writeFileSync(`../../JSON.json`, JSON.stringify(result, null, 2));
        }
      );
    });
  }

  preProcessTemplate(templateStr) {
    return super.preProcessTemplate(templateStr);
  }

  postProcessResult(inResult) {
    return super.postProcessResult(inResult);
  }

  getConversionResultMetadata(context) {
    return super.getConversionResultMetadata(context);
  }
};
