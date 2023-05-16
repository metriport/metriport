// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var CoverageArray = require("./coverage-array");

describe("Utility Arrays", function () {
  it("should create a coverage array that records when an item has been accessed", function () {
    var coverageArray = CoverageArray.makeCoverageArray();

    assert.ok(coverageArray.accessed);
    assert.equal(coverageArray.accessed.length, 0);

    coverageArray.push("new item");

    assert.equal(coverageArray.accessed.length, 1);
    assert.equal(coverageArray.accessed[0], false);

    coverageArray[0];

    assert.equal(coverageArray.accessed[0], true);
  });

  it("should create an undefined access array that records when an index without a value is accessed", function () {
    var accessArray = CoverageArray.makeUndefinedAccessReporterArray();

    assert.ok(accessArray.undefinedFieldsAccessed);
    assert.equal(accessArray.undefinedFieldsAccessed.length, 0);

    accessArray.push("new item");
    accessArray[0];

    assert.equal(accessArray.undefinedFieldsAccessed.length, 0);

    accessArray[4];

    assert.equal(accessArray.undefinedFieldsAccessed.length, 1);
    assert.equal(accessArray.undefinedFieldsAccessed[0], 4);
  });

  it("should not record access for a non-numericly named record in an undefined access array", function () {
    var accessArray = CoverageArray.makeUndefinedAccessReporterArray();

    accessArray["test"];

    assert.equal(accessArray.undefinedFieldsAccessed.length, 0);
  });

  it("should handle a request for a symbol of undefined in an undefined access array", function () {
    var accessArray = CoverageArray.makeUndefinedAccessReporterArray();

    accessArray[Symbol(undefined)];

    assert.equal(accessArray.undefinedFieldsAccessed.length, 0);
  });
});
