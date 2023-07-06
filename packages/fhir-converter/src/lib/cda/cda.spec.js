// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var cda = require("./cda");

describe("cda", function () {
  it("should preprocess template correctly.", function () {
    var result = new cda().preProcessTemplate("{{PID-2}}");
    assert.equal(result, "{{PID-2}}");
  });

  it("should postprocess result correctly.", function () {
    var result = new cda().postProcessResult('{"a":"b",,,,}');
    assert.equal(JSON.stringify(result), JSON.stringify({ a: "b" }));
  });

  it("should generate conversion metadata correctly.", function () {
    let data = "dummy";
    let result = new cda().getConversionResultMetadata(data);
    assert.equal(JSON.stringify({}), JSON.stringify(result));
  });

  it("should successfully parse correct data.", function (done) {
    let data = '<a> <b c="d"/> </a>';
    new cda()
      .parseSrcData(data)
      .then(result => {
        if (result._originalData === data) {
          done();
        } else {
          done(new Error(`_originalData doesn't match with data`));
        }
      })
      .catch(err => done(err));
  });

  it("should fail while parsing incorrect data.", function (done) {
    new cda()
      .parseSrcData('<a b c="d"/> </a>')
      .then(() => done(new Error(`parseSrcData should have failed!`)))
      .catch(() => done());
  });
});
