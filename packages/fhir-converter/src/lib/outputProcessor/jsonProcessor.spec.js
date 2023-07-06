// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var jsonProcessor = require("./jsonProcessor");

describe("jsonProcessor", function () {
  var parseTests = [
    { in: '{"a":"b"}', out: '{"a":"b"}' }, // simple case with no error
    { in: '{,"a":"b",,"c":"d",}', out: '{"a":"b","c":"d"}' }, // extra commas in obj
    { in: '{"c":[,"d",,,"e",,]}', out: '{"c":["d","e"]}' }, // extra commas in array
    { in: '{"c":[,"",]}', out: "{}" }, // empty array and obj entries
    { in: '{"a":[,],"b":[,]}', out: "{}" }, // 2 empty array
    { in: '{"a":{,},"b":{,}}', out: "{}" }, // 2 empty objs
    { in: '{"a":"","b":"d"}', out: '{"b":"d"}' }, // empty value
    { in: '{"a":"b,,}"}', out: '{"a":"b,,}"}' }, // commas and curly brace part of string
    { in: '{"a":"\\"b"}', out: '{"a":"\\"b"}' }, // quotes inside string
    { in: '{"a":"b}', out: "{}" }, // corrupted data test (just for code coverage)
    { in: '{"b":["c",],"d":{,},}', out: '{"b":["c"]}' }, // should remove empty fields in a complex input
    { in: '{"a":"1""b":"2"}', out: '{"a":"1","b":"2"}' }, // missing comma between pairs
    { in: '{"a":"""b":"2"}', out: '{"b":"2"}' }, // missing comma between pairs with first value empty
    { in: '{"a":"1","b":,"c":"3"}', out: '{"a":"1","c":"3"}' }, // missing value in middle pair
    { in: '{"a":"1","b":"c":"3"}', out: '{"a":"1","c":"3"}' }, // missing value and comma in middle pair
    { in: '{"a":"1","b","c":"3"}', out: '{"a":"1","c":"3"}' }, // only value in middle pair
    { in: '{"a":"1","b":{"c"},"d":"4"}', out: '{"a":"1","d":"4"}' }, // middle pair with incorrect value obj
  ];

  parseTests.forEach(t => {
    it(`jsonProcessor(${t.in}) should return ${t.out}`, function () {
      assert.equal(jsonProcessor.Process(t.in), t.out);
    });
  });
});
