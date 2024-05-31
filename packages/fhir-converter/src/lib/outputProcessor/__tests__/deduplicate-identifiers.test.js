// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const deduplicateIdentifiers = require("../resourceDeduplicator").deduplicateIdentifiers;

const nonFullIdentifier = {
  system: "acbd",
  value: "123",
};

const fullIdentifier = {
  ...nonFullIdentifier,
  type: { text: "EPIC" },
};

describe("deduplicateIdentifiers", function () {
  it("returns an empty array if no identifiers present", function (done) {
    const identifiers = [];

    const result = deduplicateIdentifiers(identifiers);
    expect(result.length).toBe(0);
    expect(result).toEqual([]);
    done();
  });

  it("removes a duplicate identifier", function (done) {
    const identifiers = [fullIdentifier, fullIdentifier];

    const result = deduplicateIdentifiers(identifiers);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(fullIdentifier);
    done();
  });

  it("keeps the identifier with more fields", function (done) {
    const identifiers = [fullIdentifier, nonFullIdentifier];
    const result = deduplicateIdentifiers(identifiers);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(fullIdentifier);
    done();
  });

  it("keeps all different identifiers", function (done) {
    const identifiers = [
      fullIdentifier,
      { ...fullIdentifier, system: "bcde" },
      { ...fullIdentifier, system: "cdef" },
    ];
    const result = deduplicateIdentifiers(identifiers);
    expect(result.length).toBe(3);
    done();
  });
});
