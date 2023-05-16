// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var resMerger = require("./resourceMerger");

describe("resourceMerger", function () {
  var mergeTests = [
    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", a: "1", meta: { dummy: "true" } } },
            { resource: { resourceType: "Patient", b: "2" } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1","meta":{"dummy":"true"},"b":"2"}}]}',
    }, // add property

    { in: [{ entry: [{ a: "b" }] }, {}], out: '{"entry":[{"a":"b"}]}' }, // invalid input returned as is

    { in: [{ a: "b" }, {}], out: '{"a":"b"}' }, // invalid input returned as is

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", a: "1" } },
            { resource: { resourceType: "Patient", a: "2" } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"2"}}]}',
    }, // last update wins

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", a: ["1", "2"] } },
            { resource: { resourceType: "Patient", a: ["2", "3"] } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":["1","2","3"]}}]}',
    }, // array concatenation

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", id: "1", a: "1" } },
            { resource: { resourceType: "Patient", id: "1", a: "2" } },
            { resource: { resourceType: "Patient", a: "3" } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","id":"1","a":"2"}},{"resource":{"resourceType":"Patient","a":"3"}}]}',
    }, // additional resource if different id

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", a: "1" } },
            { resource: { resourceType: "Observation", b: "2" } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1"}},{"resource":{"resourceType":"Observation","b":"2"}}]}',
    }, // merging only for same resourceType

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", id: "1", meta: { versionId: "1" } } },
            { resource: { resourceType: "Patient", id: "1", meta: { versionId: "1" } } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","id":"1","meta":{"versionId":"1"}}}]}',
    }, // 2 resources with matching type/id/versionId

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", id: "1", meta: { versionId: "1" } } },
            { resource: { resourceType: "Patient", id: "1", meta: { versionId: "2" } } },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","id":"1","meta":{"versionId":"1"}}},{"resource":{"resourceType":"Patient","id":"1","meta":{"versionId":"2"}}}]}',
    }, // 2 resources with matching type/id and non-matching versionId

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", a: "1", meta: { dummy: "true" } } },
            { resource: { resourceType: "Patient", $1$: "2" } },
          ],
        },
        { '"$1$":': '"b":' },
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1","meta":{"dummy":"true"},"b":"2"}}]}',
    }, // use replacement dictionary

    {
      in: [
        {
          entry: [
            { resource: { resourceType: "Patient", a: "1", meta: { dummy: "true" } } },
            { resource: { resourceType: "Patient", b: "2" } },
          ],
        },
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1","meta":{"dummy":"true"},"b":"2"}}]}',
    }, // no replacement dictionary
  ];

  mergeTests.forEach(t => {
    it(`resourceMerger (${JSON.stringify(t.in.join())}) should return ${t.out}`, function () {
      if (t.in.length <= 1) {
        assert.equal(JSON.stringify(resMerger.Process(t.in[0])), t.out);
      } else {
        assert.equal(JSON.stringify(resMerger.Process(t.in[0], t.in[1])), t.out);
      }
    });
  });
});
