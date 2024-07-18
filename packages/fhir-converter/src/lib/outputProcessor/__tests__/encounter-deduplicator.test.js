// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const Process = require("../resourceDeduplicator").Process;
const inputs = require("./encounter-deduplicator-inputs");
const { faker } = require("@faker-js/faker");

describe("resourceDeduplicator", function () {
  it("properly merges duplicates encounters", function (done) {
    const bundle = inputs.bundleTemplate;
    bundle.entry = [inputs.encompassingEncounter, inputs.internalEncounter];

    const result = Process(bundle);
    expect(result.entry).toEqual([inputs.mergedEncounter]);
    done();
  });

  it("returns the encounter if no duplicates", function (done) {
    const bundle = inputs.bundleTemplate;
    bundle.entry = [inputs.encompassingEncounter];

    const result = Process(bundle);
    expect(result.entry).toEqual([inputs.encompassingEncounter]);
    done();
  });

  it("deduplicates all duplicate encounters", function (done) {
    const bundle = inputs.bundleTemplate;
    const newIdentifier = faker.string.uuid();
    const newId = faker.string.uuid();
    const anotherNewId = faker.string.uuid();
    bundle.entry = [
      inputs.encompassingEncounter,
      inputs.internalEncounter,
      {
        resource: {
          ...inputs.encompassingEncounter.resource,
          id: newId,
          identifier: [
            {
              ...inputs.encompassingEncounter.resource.identifier[0],
              value: newIdentifier,
            },
          ],
        },
      },
      {
        resource: {
          ...inputs.internalEncounter.resource,
          id: anotherNewId,
          identifier: [
            {
              ...inputs.internalEncounter.resource.identifier[0],
              value: newIdentifier,
            },
          ],
        },
      },
    ];

    const result = Process(bundle);
    expect(result.entry).toEqual([
      inputs.mergedEncounter,
      {
        resource: {
          ...inputs.mergedEncounter.resource,
          id: anotherNewId,
          identifier: [
            {
              ...inputs.mergedEncounter.resource.identifier[0],
              value: newIdentifier,
            },
          ],
        },
      },
    ]);
    done();
  });
});
