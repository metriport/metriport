// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var constants = require("../constants/constants");
var fs = require("fs");
var helpers = require("./handlebars-helpers").external;
var helperUtils = require("./handlebars-helpers").internal;
var hl7 = require("../hl7v2/hl7v2");
var cda = require("../cda/cda");
var path = require("path");
var validator = require("validator");
const fse = require("fs-extra");
var HandlebarsConverter = require("./handlebars-converter");
var dataHandlerFactory = require("../dataHandler/dataHandlerFactory");

describe("Handlebars helpers", function () {
  helpers.forEach((h, idx) => {
    it("Function " + idx + " should name a name", function (done) {
      if (h.name.length == 0) {
        done(new Error("Length of name for function " + idx + " has zero length name"));
      } else {
        done();
      }
    });

    it(h.name + " should have a description", function (done) {
      if (h.description.length == 0) {
        done(new Error("Length of " + h.name + " description is zero"));
      } else {
        done();
      }
    });

    it(h.name + " should have a function definition", function (done) {
      if (h.func) {
        done();
      } else {
        done(new Error(h.name + " has no function definition"));
      }
    });
  });

  var opTests = [
    { f: "eq", in: [1, 1, {}], out: true },
    { f: "eq", in: [1, 2, {}], out: false },
    { f: "eq", in: ["foo", "foo", {}], out: true },
    { f: "eq", in: ["foo", "bar", "foo", "abc", {}], out: true },
    { f: "eq", in: ["1", "1", "2", 3, {}], out: true },
    { f: "eq", in: [1, "2", "2", 3, {}], out: false },
    { f: "ne", in: [1, 1, {}], out: false },
    { f: "ne", in: [1, 2, {}], out: true },
    { f: "ne", in: ["foo", "bar", {}], out: true },
    { f: "ne", in: ["foo", "bar", "foo", {}], out: false },
    { f: "ne", in: ["foo", "bar", "abc", "def", {}], out: true },
    { f: "not", in: [true], out: false },
    { f: "not", in: [false], out: true },
    { f: "lt", in: [1, 2], out: true },
    { f: "lt", in: [2, 1], out: false },
    { f: "lt", in: [2, 2], out: false },
    { f: "gt", in: [1, 2], out: false },
    { f: "gt", in: [2, 1], out: true },
    { f: "gt", in: [1, 1], out: false },
    { f: "lte", in: [1, 2], out: true },
    { f: "lte", in: [2, 2], out: true },
    { f: "lte", in: [2, 1], out: false },
    { f: "gte", in: [1, 2], out: false },
    { f: "gte", in: [2, 2], out: true },
    { f: "gte", in: [2, 1], out: true },
    { f: "and", in: [true, true, {}], out: true },
    { f: "and", in: [true, true, true, false, {}], out: false },
    { f: "or", in: [true, true, {}], out: true },
    { f: "or", in: [false, false, true, false, {}], out: true },
    { f: "toArray", in: [["a"]], out: ["a"] },
    { f: "toArray", in: ["a"], out: ["a"] },
    { f: "contains", in: ["abcd", "bc"], out: true },
    { f: "contains", in: [undefined, "bc"], out: false },
    { f: "split", in: ["a,b,c", ","], out: ["a", "b", "c"] },
    { f: "concat", in: ["foo", "bar", {}], out: "foobar" },
    { f: "concat", in: ["a", "b", "c", {}], out: "abc" },
    { f: "concat", in: [["a", "b"], "c", {}], out: ["a", "b", "c"] },
    { f: "elementAt", in: [["a", "b", "c"], 1], out: "b" },
    { f: "elementAt", in: [["a", "b", "c"], 5], out: undefined },
    { f: "charAt", in: ["abc", 1], out: "b" },
    { f: "length", in: [["a", "b", "c"]], out: 3 },
    { f: "length", in: [undefined], out: 0 },
    { f: "strLength", in: [undefined], out: 0 },
    { f: "strLength", in: ["abc"], out: 3 },
    {
      f: "gunzip",
      in: ["1f8b080000000000000a4b4c4a0600c241243503000000", "hex", "utf8"],
      out: "abc",
    },
    { f: "sha1Hash", in: ["abc"], out: "a9993e364706816aba3e25717850c26c9cd0d89d" },
    { f: "strSlice", in: ["abcd", 1, 3], out: "bc" },
    { f: "strSlice", in: ["abcd", 1, 10], out: "bcd" },
    { f: "slice", in: [["a", "b", "c", "d"], 1, 3], out: ["b", "c"] },
    { f: "split", in: ["a,b,c", ","], out: ["a", "b", "c"] },
    { f: "split", in: ["a,x,b,x,c", ",x"], out: ["a", ",b", ",c"] },
    { f: "replace", in: ["abcdbc", "bc", "x"], out: "axdx" },
    { f: "match", in: ["aBcdE", "[A-Z]"], out: ["B", "E"] },
    { f: "base64Encode", in: ['a"b'], out: "YSJi" },
    { f: "base64Decode", in: ["YSJi"], out: 'a"b' },
    { f: "assert", in: [true, "abc"], out: "" },
    { f: "toJsonString", in: [["a", "b"]], out: '["a","b"]' },
    { f: "addHyphensSSN", in: [undefined], out: "" },
    { f: "addHyphensDate", in: [undefined], out: "" },
    { f: "addHyphensDate", in: ["2001"], out: "2001" },
    { f: "addHyphensDate", in: ["200101"], out: "2001-01" },
    { f: "addHyphensDate", in: ["200106"], out: "2001-06" },
    { f: "addHyphensDate", in: ["200112"], out: "2001-12" },
    { f: "addHyphensDate", in: ["20011201"], out: "2001-12-01" },
    { f: "addHyphensDate", in: ["20011231"], out: "2001-12-31" },
    { f: "addHyphensDate", in: ["20010131"], out: "2001-01-31" },
    { f: "addHyphensDate", in: ["2001013100"], out: "2001-01-31" },
    { f: "addHyphensDate", in: ["200101310000"], out: "2001-01-31" },
    { f: "formatAsDateTime", in: [undefined], out: "" },
    { f: "formatAsDateTime", in: ["2004"], out: "2004" },
    { f: "formatAsDateTime", in: ["200401"], out: "2004-01" },
    { f: "formatAsDateTime", in: ["200406"], out: "2004-06" },
    { f: "formatAsDateTime", in: ["200412"], out: "2004-12" },
    { f: "formatAsDateTime", in: ["20041101"], out: "2004-11-01" },
    { f: "formatAsDateTime", in: ["20041130"], out: "2004-11-30" },
    {
      f: "formatAsDateTime",
      in: ["2014013008"],
      out: new Date(Date.UTC(2014, 0, 30, 8, 0, 0, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["2014013008-0500"],
      out: new Date(Date.UTC(2014, 0, 30, 13, 0, 0, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["2014013008+0500"],
      out: new Date(Date.UTC(2014, 0, 30, 3, 0, 0, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["201401300800"],
      out: new Date(Date.UTC(2014, 0, 30, 8, 0, 0, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["201401300800-0500"],
      out: new Date(Date.UTC(2014, 0, 30, 13, 0, 0, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["201401300800+0500"],
      out: new Date(Date.UTC(2014, 0, 30, 3, 0, 0, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051"],
      out: new Date(Date.UTC(2014, 0, 30, 8, 0, 51, 0)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051-0500"],
      out: new Date(Date.UTC(2014, 0, 30, 13, 0, 51)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051+0500"],
      out: new Date(Date.UTC(2014, 0, 30, 3, 0, 51)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130040051+0500"],
      out: new Date(Date.UTC(2014, 0, 29, 23, 0, 51)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140129230051-0500"],
      out: new Date(Date.UTC(2014, 0, 30, 4, 0, 51)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051.1"],
      out: new Date(Date.UTC(2014, 0, 30, 8, 0, 51, 100)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20040629175400.00"],
      out: new Date(Date.UTC(2004, 05, 29, 17, 54)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20040629175400.34599999"],
      out: new Date(Date.UTC(2004, 05, 29, 17, 54, 0, 345)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051.1-0500"],
      out: new Date(Date.UTC(2014, 0, 30, 13, 0, 51, 100)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051.12+0500"],
      out: new Date(Date.UTC(2014, 0, 30, 3, 0, 51, 120)).toJSON(),
    }, // eslint-disable-line
    {
      f: "formatAsDateTime",
      in: ["20140130080051.123+0500"],
      out: new Date(Date.UTC(2014, 0, 30, 3, 0, 51, 123)).toJSON(),
    }, // eslint-disable-line
    { f: "getFieldRepeats", in: [null], out: null },
    { f: "toLower", in: ["ABCD"], out: "abcd" },
    { f: "toLower", in: [undefined], out: "" },
    { f: "toUpper", in: [undefined], out: "" },
    { f: "toUpper", in: ["abcd"], out: "ABCD" },
    { f: "isNaN", in: [5], out: false },
    { f: "isNaN", in: ["A"], out: true },
    { f: "abs", in: [-5], out: 5 },
    { f: "abs", in: [3], out: 3 },
    { f: "abs", in: [0], out: 0 },
    { f: "ceil", in: [1], out: 1 },
    { f: "ceil", in: [1.1], out: 2 },
    { f: "ceil", in: [1.9], out: 2 },
    { f: "floor", in: [1], out: 1 },
    { f: "floor", in: [1.1], out: 1 },
    { f: "floor", in: [1.9], out: 1 },
    { f: "max", in: [3, 4, 5, "Object"], out: 5 }, // when called from the template, an "Object" is the final parameter passed into the function
    { f: "min", in: [3, 4, 5, "Object"], out: 3 }, // when called from the template, an "Object" is the final parameter passed into the function
    { f: "pow", in: [3, 3], out: 27 },
    { f: "round", in: [-5.5], out: -5 },
    { f: "round", in: [10], out: 10 },
    { f: "round", in: [10.9], out: 11 },
    { f: "round", in: [10.1], out: 10 },
    { f: "sign", in: [-5], out: -1 },
    { f: "sign", in: [5], out: 1 },
    { f: "sign", in: [0], out: 0 },
    { f: "trunc", in: [9.89], out: 9 },
    { f: "add", in: [5, 4], out: 9 },
    { f: "subtract", in: [5, 4], out: 1 },
    { f: "multiply", in: [2, 3], out: 6 },
    { f: "divide", in: [10, 5], out: 2 },
  ];

  opTests.forEach(t => {
    it(t.f + "(" + t.in.join(",") + ") should return " + t.out, function (done) {
      var out = getHelper(t.f).func(...t.in);
      if (JSON.stringify(t.out) === JSON.stringify(out)) {
        done();
      } else {
        done(
          new Error(t.f + "(" + t.in.join(",") + ") DOES NOT return " + t.out + ". Returns: " + out)
        );
      }
    });
  });

  var opErrorTests = [
    { f: "evaluate", in: [undefined] },
    { f: "getFieldRepeats", in: ["a"] },
    { f: "getFirstSegments", in: [undefined] },
    { f: "getSegmentLists", in: [undefined, "PID", "NK1"] },
    { f: "getRelatedSegmentList", in: [undefined] },
    { f: "getParentSegment", in: [undefined] },
    { f: "hasSegments", in: [undefined, "PID", "NK1"] },
    { f: "getFirstCdaSections", in: [undefined, "dummy", {}] },
    { f: "getFirstCdaSectionsByTemplateId", in: [undefined, "dummy", {}] },
    { f: "getCdaSectionLists", in: [undefined, "dummy", {}] },
    { f: "gzip", in: [undefined] },
    { f: "gunzip", in: [undefined] },
    { f: "split", in: ["a,x,b,x,c", ",(x"] },
    { f: "slice", in: [undefined, 1, 2] },
    { f: "strSlice", in: [undefined, 1, 2] },
    { f: "charAt", in: [undefined, 2] },
    { f: "replace", in: ["abcdbc", "b[(c", "x"] },
    { f: "match", in: ["aBcdE", "[A-Z"] },
    { f: "base64Encode", in: [undefined] },
    { f: "base64Decode", in: [undefined] },
    { f: "escapeSpecialChars", in: [undefined] },
    { f: "unescapeSpecialChars", in: [undefined] },
    { f: "formatAsDateTime", in: ["20badInput"] }, // bad input
    { f: "formatAsDateTime", in: ["2020-11"] }, // bad input
    { f: "formatAsDateTime", in: ["20140130080051--0500"] }, // bad input
    { f: "formatAsDateTime", in: ["2014.051-0500"] }, // bad input
    { f: "formatAsDateTime", in: ["20140130080051123+0500"] }, // bad input
    { f: "formatAsDateTime", in: ["20201"] }, // bad input
    { f: "formatAsDateTime", in: ["2020060"] }, // bad input
    { f: "formatAsDateTime", in: ["20201301"] }, // invalid month
    { f: "formatAsDateTime", in: ["20200134"] }, // invalid day
    { f: "formatAsDateTime", in: ["20200230"] }, // invalid day
    { f: "formatAsDateTime", in: ["2020010130"] }, // invalid hour
    { f: "formatAsDateTime", in: ["202001011080"] }, // invalid minutes
    { f: "formatAsDateTime", in: ["20200101101080"] }, // invalid seconds
    { f: "addHyphensDate", in: ["20badInput"] }, // bad input
    { f: "addHyphensDate", in: ["2020-11"] }, // bad input
    { f: "addHyphensDate", in: ["20201"] }, // bad input
    { f: "addHyphensDate", in: ["2020060"] }, // bad input
    { f: "addHyphensDate", in: ["20201301"] }, // invalid month
    { f: "addHyphensDate", in: ["20200134"] }, // invalid day
    { f: "addHyphensDate", in: ["20200230"] }, // invalid day
  ];

  opErrorTests.forEach(t => {
    it(t.f + "(" + t.in.join(",") + ") should throw error", function (done) {
      try {
        var out = getHelper(t.f).func(...t.in);
        done(new Error(t.f + "(" + t.in.join(",") + ") does not throw. Returns: " + out));
      } catch (err) {
        if (err.toString().includes(t.f)) {
          done();
        } else {
          done(new Error(`missing funcion name in error message`));
        }
      }
    });
  });

  it("gzip returns an expected value", function () {
    var result = getHelper("gzip").func("abc", "utf8", "hex");
    // note : gzip output is dependent on OS : https://stackoverflow.com/questions/26516369/zlib-gzip-produces-different-results-for-same-input-on-different-oses
    // So comparing against windows and linux output
    assert.ok(
      result === "1f8b080000000000000a4b4c4a0600c241243503000000" ||
        result === "1f8b08000000000000034b4c4a0600c241243503000000"
    );
  });

  it("Random returns a value", function () {
    var n = getHelper("random").func();
    assert.ok(n >= 0);
    assert.ok(n <= 1);
  });

  it("assert should throw correct error message", function () {
    try {
      getHelper("assert").func(false, "abc");
      assert.fail();
    } catch (err) {
      assert.equal(err, "abc");
    }
  });

  it("now should return current time", function () {
    var before = new Date();
    var currentString = getHelper("now").func();
    var after = new Date();

    var current = new Date(helperUtils.getDateTime(currentString));

    assert.ok(before <= current);
    assert.ok(current <= after);
  });

  it("toString should return a string when given an array", function () {
    var out = getHelper("toString").func(["foo", "bar"]);
    assert.strictEqual(typeof out, "string");
    assert.strictEqual(out, "foo,bar");
  });

  it("generateUUID returns the same guid for same URL", function () {
    var f = getHelper("generateUUID").func;
    assert.strictEqual(f("https://localhost/blah"), f("https://localhost/blah"));
  });

  it("generateUUID should return a guid", function () {
    assert(validator.isUUID(getHelper("generateUUID").func("https://localhost/blah")));
  });

  it("generateUUIDV2 should return a GUID", function () {
    assert(validator.isUUID(getHelper("generateUUIDV2").func("https://localhost/blah")));
  });

  it("generateUUIDV2 should return the same GUID for same URL", function () {
    const f = getHelper("generateUUIDV2").func;
    assert.strictEqual(f("https://localhost/blah"), f("https://localhost/blah"));
  });

  it("generateUUIDV2 should return different GUIDs for different URLs", function () {
    const f = getHelper("generateUUIDV2").func;
    // if we really find a md5 crash, it will be better :)
    assert.notEqual(f("https://localhost/blahblah"), f("https://localhost/foobar"));
  });

  it("generateUUIDV2 should return the same GUID for same URL with different newlines", function () {
    const f = getHelper("generateUUIDV2").func;
    // url will not contain newline character, but sometimes the generateUUID will be feed with a whole object.
    const inputs = [
      ["https://loc\ralhost/blah", "https://loca\nlhost/blah"],
      ["https://local\rhost/blah", "https://localhost/blah"],
      ["https://localhost\r\n/blah", "https://localhost/blah"],
      ["https://localho\\rst/blah", "https://localh\\nost/blah"],
      ["https://localho\\rst/blah", "https://localhost/blah"],
      ["https://loca\r\nlhost/blah", "https://localhost/blah"],
    ];
    for (const input of inputs) {
      assert.strictEqual(f(input[0]), f(input[1]));
    }
  });

  it("generateUUIDV2 should throw runtime exception when given undefined or null arguments", function () {
    var f = getHelper("generateUUIDV2").func;
    const inputs = [undefined, null];
    for (const input of inputs) {
      const error = {
        name: "Error",
        message: `Invalid argument: ${input}`,
      };
      assert.throws(() => f(input), error);
    }
  });

  it("addHyphensSSN adds hyphens when passed 9 digits", function () {
    assert.strictEqual("123-45-6789", getHelper("addHyphensSSN").func("123456789"));
  });

  it("addHyphensSSN leaves input unchanged when not 9 digits", function () {
    assert.strictEqual("123", getHelper("addHyphensSSN").func("123"));
    assert.strictEqual("111111111111", getHelper("addHyphensSSN").func("111111111111"));
    assert.strictEqual("123-45-67", getHelper("addHyphensSSN").func("123-45-67"));
  });

  it("getFirstCdaSections should return a dictionary with first instance of sections", function (done) {
    fs.readFile(path.join(constants.CDA_DATA_LOCATION, "170.314B2_Amb_CCD.cda"), (err, content) => {
      if (err) {
        done(err);
      } else {
        new cda()
          .parseSrcData(content.toString())
          .then(data => {
            var sections = getHelper("getFirstCdaSections").func(data, "Allerg", "Problem", {});
            console.log(JSON.stringify(sections.Alvfvflerg));
            if (Object.prototype.toString.call(sections.Allerg) !== "[object Object]") {
              done(new Error("Incorrect Allerg section"));
            } else if (Object.prototype.toString.call(sections.Problem) !== "[object Object]") {
              done(new Error("Incorrect Problem section"));
            } else {
              done();
            }
          })
          .catch(err => done(new Error(err.toString())));
      }
    });
  });

  it("getFirstCdaSectionsByTemplateId should return a dictionary with first instance of sections", function (done) {
    fs.readFile(path.join(constants.CDA_DATA_LOCATION, "170.314B2_Amb_CCD.cda"), (err, content) => {
      if (err) {
        done(err);
      } else {
        new cda()
          .parseSrcData(content.toString())
          .then(data => {
            var sections = getHelper("getFirstCdaSectionsByTemplateId").func(
              data,
              "2.16.840.1.113883.10.20.22.2.6.1",
              {}
            );
            if (
              Object.prototype.toString.call(sections["2_16_840_1_113883_10_20_22_2_6_1"]) !==
              "[object Object]"
            ) {
              done(new Error("Incorrect 2.16.840.1.113883.10.20.22.2.6.1 section"));
            } else {
              done();
            }
          })
          .catch(err => done(new Error(err.toString())));
      }
    });
  });

  it("getCdaSectionLists should return a dictionary with first instance of sections", function (done) {
    fs.readFile(path.join(constants.CDA_DATA_LOCATION, "170.314B2_Amb_CCD.cda"), (err, content) => {
      if (err) {
        done(err);
      } else {
        new cda()
          .parseSrcData(content.toString())
          .then(data => {
            var sections = getHelper("getCdaSectionLists").func(data, "Allerg", {});
            console.log(Object.prototype.toString.call(sections["Allerg"]));
            if (Object.prototype.toString.call(sections["Allerg"]) !== "[object Array]") {
              done(new Error("Incorrect Allerg section"));
            } else {
              done();
            }
          })
          .catch(err => done(new Error(err.toString())));
      }
    });
  });

  it("getSegmentLists should return a dictionary with segments", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "ADT01-23.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var segments = getHelper("getSegmentLists").func(msg.v2, "PID", "NK1", "IN1", {});
        if (segments.PID.length != 1) {
          done(new Error("Wrong number of PID segments"));
        } else if (segments.NK1.length != 1) {
          done(new Error("Wrong number of NK1 segments"));
        } else if (segments.IN1.length != 3) {
          done(new Error("Wrong number of IN1 segments"));
        } else {
          done();
        }
      }
    });
  });

  it("getFirstSegments should return a dictionary with first instance of segments", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "ADT04-23.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var segments = getHelper("getFirstSegments").func(msg.v2, "NK1", "IN1", {});
        if (segments.NK1[0] != 1) {
          done(new Error("Incorrect NK1 segments"));
        } else if (segments.IN1[0] != 1) {
          done(new Error("Incorrect IN1 segments"));
        } else {
          done();
        }
      }
    });
  });

  it("getFieldRepeats should return correct number of repeats", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "ADT01-28.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var segments = getHelper("getFirstSegments").func(msg.v2, "PID", {});
        var repeats1 = getHelper("getFieldRepeats").func(segments.PID[0]);
        var repeats2 = getHelper("getFieldRepeats").func(segments.PID[2]);
        if (repeats1.length != 1) {
          done(new Error(`Incorrect repeats for field ${segments.PID[0]}`));
        } else if (repeats2.length != 2) {
          done(new Error(`Incorrect repeats for field ${segments.PID[2]}`));
        } else {
          done();
        }
      }
    });
  });

  it("hasSegments should return true with valid segments", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "ADT01-23.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var result = getHelper("hasSegments").func(msg.v2, "PID", "NK1", "IN1", {});
        if (!result) {
          done(new Error("Expected segments not found"));
        } else {
          done();
        }
      }
    });
  });

  it("hasSegments should return false with valid segments", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "ADT01-23.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var result = getHelper("hasSegments").func(msg.v2, "PID", "NK1", "ORU", {});
        if (result) {
          done(new Error("ORU segment should not be found"));
        } else {
          done();
        }
      }
    });
  });

  it("getParentSegment should find parent", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "LAB-ORU-2.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var result = getHelper("getParentSegment").func(msg.v2, "OBX", 4, "OBR", {});
        if (result["OBR"]) {
          done();
        } else {
          done(new Error("OBR segment should be found"));
        }
      }
    });
  });

  it("getParentSegment should not find parent", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "LAB-ORU-2.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var result = getHelper("getParentSegment").func(msg.v2, "OBX", 4, "FOO", {});
        if (!result["FOO"]) {
          done();
        } else {
          done(new Error("OBR segment should be found"));
        }
      }
    });
  });

  it("getRelatedSegmentList should find children", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "LAB-ORU-2.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var result = getHelper("getRelatedSegmentList").func(msg.v2, "OBR", "2", "OBX");
        if (result.OBX.length == 5) {
          done();
        } else {
          done(new Error("OBX segments should be found"));
        }
      }
    });
  });

  it("getRelatedSegmentList should not find children", function (done) {
    fs.readFile(path.join(constants.HL7V2_DATA_LOCATION, "LAB-ORU-2.hl7"), (err, content) => {
      if (err) {
        done(err);
      } else {
        var msg = hl7.parseHL7v2(content.toString());
        var result = getHelper("getRelatedSegmentList").func(msg.v2, "OBR", "2", "FOO");

        if (result.FOO.length == 0) {
          done();
        } else {
          done(new Error("FOO segments should NOT be found"));
        }
      }
    });
  });
});

describe('Helper "evaluate" test', function () {
  var tempPath = path.join(__dirname, "test-helpers");
  const oldTemplateLocation = constants.TEMPLATE_FILES_LOCATION;
  const childTemplateName = "helpersTestChild.hbs";

  before(function () {
    fse.removeSync(tempPath);
    fse.ensureDirSync(tempPath);
    constants.TEMPLATE_FILES_LOCATION = tempPath;
  });

  after(function () {
    fse.removeSync(tempPath);
    constants.TEMPLATE_FILES_LOCATION = oldTemplateLocation;
  });

  it("evaluate() should work when invoked with template path and obj", function (done) {
    var session = require("cls-hooked").createNamespace(constants.CLS_NAMESPACE);
    var hl7v2Handler = dataHandlerFactory.createDataHandler("hl7v2");
    session.run(() => {
      var handlebarInstance = HandlebarsConverter.instance(true, hl7v2Handler, tempPath);
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarInstance);
      session.set(constants.CLS_KEY_TEMPLATE_LOCATION, tempPath);

      var obj = {};
      obj.hash = { x1: "1", x2: "2" };

      fse.writeFileSync(path.join(tempPath, childTemplateName), '{"a":"{{x1}}", "b":"{{x2}}"}');
      var result = getHelper("evaluate").func(childTemplateName, obj);

      if (result["a"] == "1") {
        // 2nd iteration to test cache by assigning incorrect path to template location
        constants.TEMPLATE_FILES_LOCATION = "";
        result = getHelper("evaluate").func(childTemplateName, obj);

        if (result["b"] == "2") {
          done();
        } else {
          done(new Error("Incorrect output"));
        }
      } else {
        done(new Error("Incorrect output"));
      }
    });
  });
});

function getHelper(helperName) {
  for (var i = 0; i < helpers.length; i++) {
    if (helpers[i].name === helperName) {
      return helpers[i];
    }
  }
}
