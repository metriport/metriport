// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const assert = require("assert");
const interceptors = require("./interceptors");
const dataNormal = () => ({
  resourceType: "Bundle",
  type: "batch",
  entry: [
    {
      fullUrl: "urn:uuid:7536a83a-0dbf-3c3d-8af5-13629bcfeade",
      resource: {
        resourceType: "DocumentReference",
        id: "7536a83a-0dbf-3c3d-8af5-13629bcfeade",
        type: {},
        date: "2020-07-20T06:03:58.183Z",
        status: "current",
        content: [],
      },
      request: {},
    },
  ],
});
const dataInvalid = () => [
  undefined,
  null,
  "is not plain object",
  {},
  {
    resourceType: "Bundle",
    type: "batch",
    entry: "entry",
  },
  {
    resourceType: "Bundle",
    type: "batch",
    entry: [{}],
  },
  {
    resourceType: "Bundle",
    type: "batch",
    entry: [
      {
        fullUrl: "urn:uuid:ab06cca0-80d5-3efe-9322-84093fb5c5da",
        resource: {},
        request: {},
      },
    ],
  },
  {
    resourceType: "Bundle",
    type: "batch",
    entry: [
      {
        fullUrl: "urn:uuid:ab06cca0-80d5-3efe-9322-84093fb5c5da",
        resource: {
          resourceType: "RelatedPerson",
          id: "ab06cca0-80d5-3efe-9322-84093fb5c5da",
          relationship: [],
          name: [],
          telecom: [],
          address: [],
          patient: {},
        },
        request: {},
      },
    ],
  },
];

describe("Regression test interceptors - ExtraDynamicFieldInterceptor", () => {
  it("should handle extra field properly when given normal input", () => {
    const interceptor = new interceptors.ExtraDynamicFieldInterceptor(null);
    const expect = dataNormal();
    const result = interceptor.handle(dataNormal());
    expect["entry"][0]["fullUrl"] = "removed";
    expect["entry"][0]["resource"]["date"] = "removed";
    expect["entry"][0]["resource"]["id"] = "removed";

    assert.deepStrictEqual(result, expect);
  });
  it("should return the origin data when encountering invalid input", () => {
    const interceptor = new interceptors.ExtraDynamicFieldInterceptor(null);
    const expect = dataInvalid();
    const actual = dataInvalid();

    for (let i = 0; i < actual.length; ++i) {
      const result = interceptor.handle(actual[i]);
      assert.deepStrictEqual(result, expect[i]);
    }
  });
  it("should work normally when series with other interceptors", () => {
    const innerInterceptor = new interceptors.DoNothingInterceptor(null);
    const interceptor = new interceptors.ExtraDynamicFieldInterceptor(innerInterceptor);
    const expect = dataNormal();
    const result = interceptor.handle(dataNormal());
    expect["entry"][0]["fullUrl"] = "removed";
    expect["entry"][0]["resource"]["date"] = "removed";
    expect["entry"][0]["resource"]["id"] = "removed";

    assert.deepStrictEqual(result, expect);
  });
});
