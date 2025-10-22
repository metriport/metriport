// -------------------------------------------------------------------------------------------------
// Copyright (c) 2022-present Metriport Inc.
//
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//     Copyright (c) Microsoft Corporation. All rights reserved.
//
//     Permission to use, copy, modify, and/or distribute this software
//     for any purpose with or without fee is hereby granted, provided
//     that the above copyright notice and this permission notice appear
//     in all copies.
//
//     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
//     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
//     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
//     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
//     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
//     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
//     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
//     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
// -------------------------------------------------------------------------------------------------

let parseString = require("xml2js").parseString;
let Builder = require("xml2js").Builder;
let dataHandler = require("../dataHandler/dataHandler");
let minifyXML = require("minify-xml");
const { XMLParser } = require("fast-xml-parser");

const elementTime00010101Regex = new RegExp('<time value="00010101000000+0000"s*/>', "g");
const elementTime00010101Replacement = "";
const valueTime00010101Regex = new RegExp('value="00010101000000*"s*/>', "g");
const valueTime00010101Replacement = 'nullFlavor="NI" />';

const ampersandRegex = new RegExp("&(?!(?:#\\d+|#x[\\da-fA-F]+|amp|lt|gt|quot|apos);)", "g");

module.exports = class cda extends dataHandler {
  constructor() {
    super("cda");
    this.idToValueMap = {};
    this.idToB64ValueMap = {};
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
    return text == undefined ? "" : String(text).replace(/(\r\n|\n|\r)/gm, " ");
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
            obj[key] = { _b64: existingText };
          }
          // we found the prop, change it's value to the reference text
          else if (value.reference && value.reference.value) {
            const id = value.reference.value.substring(1);
            const foundText = this.idToValueMap[id];
            const foundB64 = this.idToB64ValueMap[id];
            if (foundB64) {
              // if we found b64, just use it, we shouldn't mix this with any existing text
              obj[key] = { _b64: foundB64 };
            } else if (foundText) {
              const newText =
                existingText && existingText !== foundText
                  ? `${existingText} - ${foundText}`
                  : foundText;
              obj[key] = { _: this.removeLineBreaks(newText) };
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
    res = res.replace(ampersandRegex, "&amp;");

    return res;
  }

  parseSrcData(data) {
    return new Promise((fulfill, reject) => {
      if (typeof data === "string" && data.includes("nonXMLBody")) {
        return reject(new Error("Can not convert unstructured CDA with nonXMLBody"));
      }
      let minifiedData = minifyXML.minify(data, {
        removeComments: true,
        removeWhitespaceBetweenTags: false, // Keep whitespace between tags to preserve spacing in text nodes
        considerPreserveWhitespace: true,
        collapseWhitespaceInTags: true,
        collapseEmptyElements: true,
        trimWhitespaceFromTexts: false, // Don't trim - preserves formatting
        collapseWhitespaceInTexts: false, // Don't collapse - preserves line breaks and spacing
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
              const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "",
                textNodeName: "_",
                alwaysCreateTextNode: true,
                parseAttributeValue: false,
                removeNSPrefix: false,
                trimValues: true,
                numberParseOptions: {
                  hex: false,
                  leadingZeros: false,
                },
              });

              try {
                result = parser.parse(data);
                this.findAndReplaceAllReferencesWithTextValues(result);
                result._originalData = data;
                fulfill(result);
              } catch (err) {
                // if still throwing an error, give up
                reject(err);
              }
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
