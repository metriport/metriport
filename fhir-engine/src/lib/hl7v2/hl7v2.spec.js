// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var fs = require("fs");
var hl7 = require("./hl7v2");
var path = require("path");
var templatePreprocessor = require("../inputProcessor/templatePreprocessor");
var HandlebarsConverter = require("../handlebars-converter/handlebars-converter");

describe("hl7v2", function () {
  it("should throw when first segment is not MSH.", function () {
    assert.throws(
      () => {
        hl7.parseHL7v2("MSQ|||");
      },
      Error,
      "Invalid HL7 v2 message, first segment id = MSQ"
    );
  });

  it("should throw when MSH segment does not contain separators.", function () {
    assert.throws(
      () => {
        hl7.parseHL7v2("MSH|||");
      },
      Error,
      "MSH segment missing separators!"
    );
  });

  it("should throw when separators are not unique.", function () {
    assert.throws(
      () => {
        hl7.parseHL7v2("MSH|^~^#|");
      },
      Error,
      "Duplicate separators"
    );
  });

  it("should throw when escape character is not backspace", function () {
    assert.throws(
      () => {
        hl7.parseHL7v2("MSH|^~#&|NES|NINTENDO|");
      },
      Error,
      "Escape character is *not* backspace. This has not been tested!"
    );
  });

  var fileNames = [
    "ADT01-23.hl7",
    "ADT04-23.hl7",
    "ADT04-251.hl7",
    "IZ_1_1.1_Admin_Child_Max_Message.hl7",
    "LRI_2.0-NG_CBC_Typ_Message.hl7",
  ];
  fileNames.forEach(fileName => {
    it(
      "should return an array when given valid HL7 v2 message (" + fileName + ")",
      function (done) {
        var messageFile = path.join(path.join(__dirname, "../../sample-data/hl7v2"), fileName);
        parseFile(messageFile, function (out) {
          done(Array.isArray(out));
        });
      }
    );
  });

  it("should preprocess template correctly.", function () {
    var result = new hl7().preProcessTemplate("{{PID-2}}");
    assert.equal(result, "{{PID.[1]}}");
  });

  it("should postprocess result correctly.", function () {
    var result = new hl7().postProcessResult('{"a":"b",,,,}');
    assert.equal(JSON.stringify(result), JSON.stringify({ a: "b" }));
  });

  it("should successfully parse correct data.", function (done) {
    new hl7()
      .parseSrcData("MSH|^~\\&|AccMgr|1|||20050110045504||ADT^A01|599102|P|2.3|||")
      .then(() => done())
      .catch(() => assert.fail());
  });

  it("should fail while parsing incorrect data.", function (done) {
    new hl7()
      .parseSrcData("MSQ|||")
      .then(() => assert.fail())
      .catch(() => done());
  });
});

describe("hl7.parseCoverageReport", function () {
  it("should successfully parse a coverage report", function (done) {
    var messageFile = path.join(path.join(__dirname, "../../test-data"), "coverage-test.hl7");
    convertFile(messageFile, "basic.hbs", msgContext => {
      var coverageReport = new hl7().getConversionResultMetadata(msgContext).unusedSegments;
      assert.deepEqual(coverageReport, [
        {
          type: "MSH",
          line: 0,
          field: [
            {
              component: [
                {
                  value: "NES",
                  index: 0,
                },
              ],
              index: 2,
            },
            {
              component: [
                {
                  value: "NINTENDO",
                  index: 0,
                },
              ],
              index: 3,
            },
          ],
        },
      ]);
      done();
    });
  });
});

describe("hl7.parseInvalidAccess", function () {
  it("should successfully parse an invalid access report", function (done) {
    var messageFile = path.join(path.join(__dirname, "../../test-data"), "coverage-test.hl7");
    convertFile(messageFile, "basic.hbs", msgContext => {
      var accessReport = new hl7().getConversionResultMetadata(msgContext).invalidAccess;
      assert.deepEqual(accessReport, [
        {
          type: "NK1",
          line: 2,
          field: [
            {
              index: 222,
            },
          ],
        },
        {
          type: "NK1",
          line: 3,
          field: [
            {
              index: 6,
            },
            {
              index: 222,
            },
          ],
        },
      ]);
      done();
    });
  });
});

function GetTemplate(templateString) {
  var instance = HandlebarsConverter.instance(true, "../../test-data/templates");
  return instance.compile(templatePreprocessor.Process(templateString));
}

function parseFile(filePath, cb) {
  fs.readFile(filePath, (err, msg) => {
    cb(hl7.parseHL7v2(msg.toString()));
  });
}

function convertFile(msgFile, templateFile, cb) {
  parseFile(msgFile, parsedMsg => {
    var templateFolder = path.join(__dirname, "../../test-data/templates");
    fs.readFile(path.join(templateFolder, templateFile), (err, template) => {
      GetTemplate(template.toString())({ msg: parsedMsg });
      cb(parsedMsg);
    });
  });
}
