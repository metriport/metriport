// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var resMover = require("./resourceMover");

describe("resourceMover", function () {
  var mergeTests = [
    {
      in: [
        {
          entry: [
            {
              resource: {
                resourceType: "Patient",
                a: "1",
                randomKey: {
                  resource: { resourceType: "Location", b: "2" },
                  _moveResourceToGlobalScope: "true",
                },
              },
            },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1"}},{"resource":{"resourceType":"Location","b":"2"}}]}',
    }, // resource movement

    {
      in: [
        {
          entry: [
            {
              resource: {
                resourceType: "Patient",
                a: "1",
                randomKey: {
                  resource: { resourceType: "Location", $1$: "2" },
                  _moveResourceToGlobalScope: "true",
                },
              },
            },
          ],
        },
        { '"$1$":': '"b":' },
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1"}},{"resource":{"resourceType":"Location","b":"2"}}]}',
    }, // resource movement

    {
      in: [
        {
          entry: [
            {
              resource: {
                resourceType: "Patient",
                a: "1",
                randomKey: { resource: { resourceType: "Location", b: "2" } },
              },
            },
          ],
        },
        {},
      ],
      out: '{"entry":[{"resource":{"resourceType":"Patient","a":"1","randomKey":{"resource":{"resourceType":"Location","b":"2"}}}}]}',
    }, // no movement without _moveResourceToGlobalScope

    { in: [{ a: "b" }, {}], out: '{"a":"b"}' }, // invalid input returned as is
  ];

  mergeTests.forEach(t => {
    it(`resourceMover (${JSON.stringify(t.in.join())}) should return ${t.out}`, function () {
      assert.equal(JSON.stringify(resMover.Process(t.in[0], t.in[1])), t.out);
    });
  });
});
