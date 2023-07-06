// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const path = require("path");
const assert = require("assert");
const fs = require("fs-extra");
const cases = require("../config");
const generator = require("./generate-ground-truths");
const utils = require("./utils");
const MAX_TEST_TIME = 10000;

const clearTestDir = basePath => {
  if (fs.pathExistsSync(basePath)) {
    fs.removeSync(basePath);
  }
};

describe("Regression test generate-ground-truths - main", () => {
  const basePath = path.join(__dirname, "../data/test");
  const allCases = cases.cdaCases.concat(cases.hl7v2Cases);

  beforeEach("clean work directory before testing", () => clearTestDir(basePath));
  afterEach("clean work directory after testing", () => clearTestDir(basePath));
  after("clean work directory after all testing", () => clearTestDir(basePath));

  it("should generate normal ground truth files in normal situations", () => {
    return generator
      .generate(basePath)
      .then(result => {
        for (const subCase of allCases) {
          const domain = path.extname(subCase.dataFile) === ".hl7" ? "hl7v2" : "cda";
          const domainPath = path.join(basePath, domain);
          const filePath = path.join(
            domainPath,
            subCase.templateFile,
            utils.getGroundTruthFileName(subCase)
          );
          assert.strictEqual(typeof result, "object");
          assert.ok(fs.pathExistsSync(filePath));
        }
      })
      .catch(console.error);
  }).timeout(MAX_TEST_TIME);
  it("should return understandable prompt if truth files are exist", () => {
    fs.ensureDirSync(path.join(basePath, "cda"));
    fs.ensureDirSync(path.join(basePath, "hl7v2"));
    return generator
      .generate(basePath)
      .then(prompt => {
        const trimedPrompt = prompt
          .split("\n")
          .map(e => e.trim())
          .join("");
        assert.strictEqual(
          trimedPrompt,
          `The truths files are already exist in ${basePath}.Please remove them manually for the normal operation of the program.`
        );
      })
      .catch(console.error);
  }).timeout(MAX_TEST_TIME);
  it("should return understandable prompt if truth files are exist", () => {
    for (const subCase of allCases) {
      const domain = path.extname(subCase.dataFile) === ".hl7" ? "hl7v2" : "cda";
      fs.ensureDirSync(path.join(basePath, domain, subCase.templateFile));
    }
    return generator
      .generate(basePath)
      .then(prompt => {
        const trimedPrompt = prompt
          .split("\n")
          .map(e => e.trim())
          .join("");
        assert.strictEqual(
          trimedPrompt,
          `The truths files are already exist in ${basePath}.Please remove them manually for the normal operation of the program.`
        );
      })
      .catch(console.error);
  });
});
