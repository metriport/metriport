// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const assert = require("assert");
const commonUtils = require("../../util/utils");
const utils = require("./utils");

const testData = () => ({
  resourceType: "Bundle",
  type: "batch",
  entry: [
    {
      fullUrl: "urn:uuid:7536a83a-0dbf-3c3d-8af5-13629bcfeade",
      resource: {
        resourceType: "DocumentReference",
        id: "7536a83a-0dbf-3c3d-8af5-13629bcfeade",
        type: {
          coding: [
            {
              code: "11490-0",
              display: "Discharge summarization note",
              system: "http://loinc.org",
            },
          ],
        },
        date: "2020-07-21T01:14:58.855Z",
        status: "current",
        content: [
          {
            attachment: {
              contentType: "text/plain",
              data: "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",
              hash: "rjCfhWBHl4xUJr4mTUeM6SMQyn8=",
            },
          },
        ],
      },
      request: {
        method: "PUT",
        url: "DocumentReference/7536a83a-0dbf-3c3d-8af5-13629bcfeade",
      },
    },
  ],
});

describe("Regression test testUtils - getGroundTruthFileName", () => {
  it("should generate normal ground truth file name", () => {
    const testCase = { dataFile: "sample.cda", templateFile: "ccd.hbs" };
    const fileName = utils.getGroundTruthFileName(testCase);
    assert.strictEqual(fileName, "ccd.hbs-sample.cda.json");
  });
  it("should throw appropriate error when encountering invalid input.", () => {
    const testCases = [
      null,
      undefined,
      true,
      "invalid-input",
      [],
      ["sample.cda", "ccd.hbs"],
      {},
      { dataFile: "sample.cda", templateFile_invalid: "ccd.hbs" },
      { dataFile_invalid: "sample.cda", templateFile: "ccd.hbs" },
      { dataFile_invalid: "sample.cda", templateFile_invalid: "ccd.hbs" },
    ];
    const expectError = {
      name: "Error",
      message: "The testCase should both have property [templateFile] and [dataFile].",
    };
    for (const testCase of testCases) {
      assert.throws(() => utils.getGroundTruthFileName(testCase), expectError);
    }
  });
});

describe("Regression test testUtils - compareContent", () => {
  it("should compare correctly when given equal parameters deeper than threshold", () => {
    const parameters = [
      [commonUtils.createDeepObject(100, false), commonUtils.createDeepObject(100, false)],
      [commonUtils.createDeepObject(128, false), commonUtils.createDeepObject(128, false)],
      [commonUtils.createDeepObject(256, false), commonUtils.createDeepObject(256, false)],
    ];
    for (const parameter of parameters) {
      assert.ok(utils.compareContent(...parameter.map(JSON.stringify)));
    }
  });

  it("should compare correctly when given equal plain object", () => {
    const left = testData(),
      right = testData();
    assert.ok(utils.compareContent(...[left, right].map(JSON.stringify)));
  });
  it("should compare correctly when given equal arrays", () => {
    const parameters = [
      ["[1, 2, 3, 4]", "[4, 2, 3, 1]"],
      ['["Cat", "Apple", "Dog"]', '["Apple", "Cat", "Dog"]'],
      ['{"items": [1, 2, 3, 4]}', '{"items": [4, 2, 3, 1]}'],
      ['{"items": ["Apple", "Cat", "Dog"]}', '{"items": ["Cat", "Apple", "Dog"]}'],
    ];
    for (const parameter of parameters) {
      assert.ok(utils.compareContent(...parameter));
    }
  });
  it("should compare correctly when given equal primitive parameters", () => {
    const parameters = [
      ["1", "1"],
      ["3.14159", "3.14159"],
      ["true", "true"],
      ['"parameter"', '"parameter"'],
    ];
    for (const parameter of parameters) {
      assert.ok(utils.compareContent(...parameter));
    }
  });
  it("should throw error when given unequal parameters deeper than threshold", () => {
    const parameters = [
      [commonUtils.createDeepObject(100, true), commonUtils.createDeepObject(100, true)],
      [commonUtils.createDeepObject(128, true), commonUtils.createDeepObject(128, true)],
      [commonUtils.createDeepObject(256, true), commonUtils.createDeepObject(256, true)],
    ];
    const expectError = {
      name: "Error",
      message: undefined,
    };
    for (const parameter of parameters) {
      const errorProperty = Array.from(new Array(utils.MAX_COMPARISION_DEPTH), (__, i) => i)
        .map(e => `property-${e}`)
        .join(".");
      expectError.message = `The conversion result has different property: [${errorProperty}.]`;
      assert.throws(() => utils.compareContent(...parameter.map(JSON.stringify)), expectError);
    }
  });
  it("should compare correctly when given parameters that only different with fields to be deleted", () => {
    const left = testData(),
      right = testData();
    right.entry[0].resource.date = "different";
    assert.ok(utils.compareContent(...[left, right].map(JSON.stringify)));
  });
  it("should throw error when given unequal plain object", () => {
    const left = testData(),
      right = testData();
    right.entry[0].resource.fullUrl = "Differen-Url";
    const expectError = {
      name: "Error",
      message: "The conversion result has different property: [entry.Array]",
    };
    assert.throws(() => utils.compareContent(...[left, right].map(JSON.stringify)), expectError);
  });
  it("should throw error when left object owns more properties than right", () => {
    const left = testData(),
      right = testData();
    left["newProperty"] = "new property value";
    const expectError = {
      name: "Error",
      message: "The conversion result has these extra properties: [[newProperty]]",
    };
    assert.throws(() => utils.compareContent(...[left, right].map(JSON.stringify)), expectError);
  });
  it("should throw error when right object owns more properties than left", () => {
    const left = testData(),
      right = testData();
    right["newProperty"] = "new property value";
    const expectError = {
      name: "Error",
      message: "The conversion result lacks these properties: [[newProperty]]",
    };
    assert.throws(() => utils.compareContent(...[left, right].map(JSON.stringify)), expectError);
  });
  it("should throw error when given unequal arrays", () => {
    const parameters = [
      [["[1, 2, 3, 4]", "[2, 3, 4]"], ""],
      [["[1, 2, 3, 4]", '["Apple", "Cat", "Dog"]'], ""],
      [['{"items": [1, 2, 3, 4]}', '{"items": ["Apple", "Cat", "Dog"]}'], "items."],
    ];
    const expectError = {
      name: "Error",
      message: undefined,
    };
    for (const parameter of parameters) {
      expectError.message = `The conversion result has different property: [${parameter[1]}Array]`;
      assert.throws(() => utils.compareContent(...parameter[0]), expectError);
    }
  });
  it("should throw error when given parameters with different types", () => {
    const parameters = [['{"name": "Ferris"}', "[1, 2, 3, 4]"]];
    const expectError = {
      name: "Error",
      message: "The conversion result has different property: []",
    };
    for (const parameter of parameters) {
      assert.throws(() => utils.compareContent(...parameter), expectError);
    }
  });
  it("should throw error when given non-string parameters", () => {
    const parameters = [
      [null, "{}"],
      ["{}", null],
      [null, undefined],
      [[], {}],
      [new Set(), 2019],
    ];
    const expectError = {
      name: "Error",
      message: "The parameters must be both string type.",
    };
    for (const parameter of parameters) {
      assert.throws(() => utils.compareContent(...parameter), expectError);
    }
  });
  it("should throw error when given parameters that can not be parsed by JSON.parse", () => {
    const parameters = [
      ["1", "parameter"],
      ["another parameter", "3.1415926"],
    ];
    const expectError = {
      name: "SyntaxError",
    };
    for (const parameter of parameters) {
      assert.throws(() => utils.compareContent(...parameter), expectError);
    }
  });
});
