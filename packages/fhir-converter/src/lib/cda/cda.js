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

const elementTime00010101Regex = new RegExp('<time value="00010101000000+0000"s*/>', "g");
const elementTime00010101Replacement = "";
const valueTime00010101Regex = new RegExp('value="00010101000000*"s*/>', "g");
const valueTime00010101Replacement = 'nullFlavor="NI" />';

module.exports = class cda extends dataHandler {
  idToValueMap = {};
  idToB64ValueMap = {};
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
            const xmlString = new Builder({ headless: true }).buildObject(obj);
            this.idToB64ValueMap[id] = Buffer.from(xmlString, "utf-8").toString("base64");
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

  removeLineBreaks(text) {
    return text.replace(/(\r\n|\n|\r)/gm, " ");
  }

  findAndReplacePropsWithIdValue(obj, propNames) {
    if (typeof obj === "object" && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (propNames.includes(key.toLowerCase())) {
          let value = obj[key];
          let existingText = value["_"];
          const existingIsB64 =
            existingText !== undefined &&
            typeof value["representation"] === "string" &&
            value["representation"].toLowerCase() === "b64";

          if (existingIsB64) {
            // if we already have a b64 string, just use it, as the reference will be a dup
            obj[key] = { _b64: this.removeLineBreaks(existingText) };
          }
          // we found the prop, change it's value to the reference text
          else if (value.reference && value.reference.value) {
            const id = value.reference.value.substring(1);
            const foundText = this.idToValueMap[id];
            const foundB64 = this.idToB64ValueMap[id];
            if (foundText) {
              const newText =
                existingText && existingText !== foundText
                  ? `${existingText} - ${foundText}`
                  : foundText;
              obj[key] = { _: this.removeLineBreaks(newText) };
            } else if (foundB64) {
              // if we found b64, just use it, we shouldn't mix this with any existing text
              obj[key] = { _b64: this.removeLineBreaks(foundB64) };
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

  preProcessData(data) {
    let res = data;
    // TODO: this just replaces it with spaces, which makes the dr note formatting not ideal,
    // need to figure out a smart way to preserve them in the original note
    for (const stringToReplace of ["<br />", "<br/>", "<br>"]) {
      // doing this is apparently more efficient than just using replace
      const regex = new RegExp(stringToReplace, "g");
      res = res.replace(regex, "\n");
    }
    res = res.replace(elementTime00010101Regex, elementTime00010101Replacement);
    res = res.replace(valueTime00010101Regex, valueTime00010101Replacement);
    return res;
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
      minifiedData = this.preProcessData(minifiedData);
      // fs.writeFileSync(`../../minified.xml`, JSON.stringify(minifiedData, null, 2));
      const parseOptions = {
        trim: true,
        explicitCharkey: true,
        mergeAttrs: true,
        explicitArray: false,
      };
      parseString(minifiedData, parseOptions, (err, result) => {
        if (err) {
          // if parsing throws an error on minified data, try on original
          parseString(data, parseOptions, (err, result) => {
            if (err) {
              // if still throwing an error, give up
              reject(err);
            }
            this.findAndReplaceAllReferencesWithTextValues(result);
            result._originalData = data;
            fulfill(result);
            // fs.writeFileSync(`../../JSON.json`, JSON.stringify(result, null, 2));
          });
        } else {
          this.findAndReplaceAllReferencesWithTextValues(result);
          result._originalData = minifiedData;
          fulfill(result);
        }
        // fs.writeFileSync(`../../JSON.json`, JSON.stringify(result, null, 2));
      });

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
