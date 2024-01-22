// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

let parseString = require("xml2js").parseString;
let Builder = require("xml2js").Builder;
let dataHandler = require("../dataHandler/dataHandler");
const fs = require("fs");
let minifyXML = require("minify-xml");
// const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");

module.exports = class cda extends dataHandler {
  idToValueMap = {};
  constructor() {
    super("cda");
  }

  populateIDValueMap(obj) {
    if (typeof obj === "object" && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase() == "id") {
          const id = obj[key];
          const idValue = obj["_"];
          if (idValue) {
            this.idToValueMap[id] = idValue;
          } else {
            let xmlString = new Builder({ headless: true }).buildObject(obj);
            this.idToValueMap[id] = Buffer.from(xmlString, "utf-8").toString("base64");
          }
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
          let existingText = value["_"];
          // we found the prop, change it's value to the reference text
          if (value.reference && value.reference.value) {
            const id = value.reference.value.substring(1);
            const foundText = this.idToValueMap[id];
            if (foundText) {
              const newText =
                existingText && existingText !== foundText
                  ? `${existingText} - ${foundText}`
                  : foundText;
              obj[key] = { _: newText };
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
    const valueProp = "value";
    this.populateIDValueMap(cdaJSON);
    this.findAndReplacePropsWithIdValue(cdaJSON, [textProp, originalTextProp, valueProp]);
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
      // TODO: this just replaces it with spaces, which makes the dr note formatting not ideal,
      // need to figure out a smart way to preserve them in the original note
      for (const stringToReplace of ["<br />", "<br/>", "<br>"]) {
        // doing this is apparently more efficient than just using replace
        const regex = new RegExp(stringToReplace, "g");
        minifiedData = minifiedData.replace(regex, " ");
      }
      // fs.writeFileSync(`../../minified.xml`, JSON.stringify(minifiedData, null, 2));
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
          fs.writeFileSync(`../../JSON1.json`, JSON.stringify(result, null, 2));
        }
      );

      // ----- example of using fast-xml-parser, couldn't get this to work properly

      // const options = {
      //   ignoreAttributes: false,
      //   textNodeName: "_",
      //   alwaysCreateTextNode: true,
      //   trimValues: true,
      //   parseTagValue: true,
      //   attributeNamePrefix: "",
      //   // TODO: this doesn't work to skip all <br> tags
      //   // updateTag(tagName, jPath, attrs) {
      //   //   if (tagName === "br" || tagName === "br ") return false;
      //   // },
      // };
      // const parser = new XMLParser(options);
      // let result = parser.parse(minifiedData);
      // fulfill(result);
      // fs.writeFileSync(`../../JSON.json`, JSON.stringify(result, null, 2));
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
