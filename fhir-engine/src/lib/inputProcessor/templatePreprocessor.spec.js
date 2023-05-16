// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var templatePreprocessor = require("./templatePreprocessor");

describe("templatePreprocessor", function () {
  var preprocessTests = [
    { in: "{{PID-5}}", out: "{{PID.[4]}}" }, // single '-'
    { in: "{{a-2-3}}", out: "{{a.[1].[2]}}" }, // multiple '-'
    { in: "{{a-5 b-3}}", out: "{{a.[4] b.[2]}}" }, // multiple fields
    { in: "{{a.2.3}}", out: "{{a.2.3}}" }, // dots (object member notation) not modified
    { in: "{{a-2.3}}", out: "{{a.[1].3}}" }, // only '-' modified in mix & match
    { in: "a-2", out: "a-2" }, // no modification without '{{ }}'
    { in: "{{a.[0].[4]}}", out: "{{a.[0].[4]}}" }, // handlebar array notation still works
    { in: '"{{a-5}}"', out: '"{{a.[4]}}"' }, // works inside quotes
    { in: '"\\{{a-5}}"', out: '"\\{{a-5}}"' }, // no modification if {{ not intended for handlebar
    { in: "{{a-0}}", out: "{{a-0}}" }, // no modification for 0
  ];

  preprocessTests.forEach(t => {
    it(`templatePreprocessor(${t.in}) should return ${t.out}`, function () {
      assert.equal(templatePreprocessor.Process(t.in), t.out);
    });
  });
});
