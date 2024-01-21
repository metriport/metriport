// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

let parseString = require("xml2js").parseString;
let dataHandler = require("../dataHandler/dataHandler");
const fs = require("fs");
let minifyXML = require("minify-xml");

module.exports = class cda extends dataHandler {
  idToValueMap = {};
  constructor() {
    super("cda");
  }

  populateIDValueMap(obj) {
    if (typeof obj === "object" && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase() == "id" && obj["_"]) {
          const id = obj[key];
          const idValue = obj["_"];
          this.idToValueMap[id] = idValue;
        }
        this.populateIDValueMap(obj[key]);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(value => {
        this.populateIDValueMap(value);
      });
    }
  }

  findAndReplacePropsWithIdValue(obj, propNames) {
    if (typeof obj === "object" && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (propNames.includes(key.toLowerCase())) {
          let value = obj[key];
          // we found the prop, change it's value to the
          if (value.reference && value.reference.value) {
            const id = value.reference.value.substring(1);
            if (this.idToValueMap[id]) {
              obj[key] = { _: this.idToValueMap[id] };
            }
          }
        }
        this.findAndReplacePropsWithIdValue(obj[key], propNames);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(value => {
        this.findAndReplacePropsWithIdValue(value, propNames);
      });
    }
  }

  findAndReplaceAllReferencesWithTextValues(cdaJSON) {
    const textProp = "text";
    const originalTextProp = "originaltext";
    this.populateIDValueMap(cdaJSON);
    this.findAndReplacePropsWithIdValue(cdaJSON, [textProp, originalTextProp]);
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
        (err, result) => {
          if (err) {
            reject(err);
          }
          this.findAndReplaceAllReferencesWithTextValues(result);
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
