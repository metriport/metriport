// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var testRules = require("./test-rule-functions");
var fs = require("fs");
var path = require("path");
const commonUtils = require("../../util/utils");

var onePatientBundle = {
  resourceType: "Bundle",
  type: "batch",
  entry: [
    {
      fullUrl: "urn:uuid:40386838-40ff-3f80-b68b-4904de7e7b7b",
      resource: {
        resourceType: "Composition",
        id: "40386838-40ff-3f80-b68b-4904de7e7b7b",
        identifier: {
          use: "official",
          value: "2.16.840.1.113883.19.5.99999.1",
        },
      },
    },
    {
      fullUrl: "urn:uuid:2745d583-e3d1-3f88-8b21-7b59adb60779",
      resource: {
        resourceType: "Patient",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        },
        id: "2745d583-e3d1-3f88-8b21-7b59adb60779",
      },
    },
  ],
};

var twoPatientSameGuidBundle = {
  resourceType: "Bundle",
  type: "batch",
  entry: [
    {
      fullUrl: "urn:uuid:40386838-40ff-3f80-b68b-4904de7e7b7b",
      resource: {
        resourceType: "Composition",
        id: "40386838-40ff-3f80-b68b-4904de7e7b7b",
        identifier: {
          use: "official",
          value: "2.16.840.1.113883.19.5.99999.1",
        },
      },
    },
    {
      fullUrl: "urn:uuid:2745d583-e3d1-3f88-8b21-7b59adb60779",
      resource: {
        resourceType: "Patient",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        },
        id: "2745d583-e3d1-3f88-8b21-7b59adb60779",
      },
    },
    {
      fullUrl: "urn:uuid:2745d583-e3d1-3f88-8b21-7b59adb60779",
      resource: {
        resourceType: "Patient",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        },
        id: "2745d583-e3d1-3f88-8b21-7b59adb60779",
      },
    },
  ],
};

var patientEncounterSameGuidBundle = {
  resourceType: "Bundle",
  type: "batch",
  entry: [
    {
      fullUrl: "urn:uuid:40386838-40ff-3f80-b68b-4904de7e7b7b",
      resource: {
        resourceType: "Composition",
        id: "40386838-40ff-3f80-b68b-4904de7e7b7b",
        identifier: {
          use: "official",
          value: "2.16.840.1.113883.19.5.99999.1",
        },
      },
    },
    {
      fullUrl: "urn:uuid:2745d583-e3d1-3f88-8b21-7b59adb60779",
      resource: {
        resourceType: "Patient",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        },
        id: "2745d583-e3d1-3f88-8b21-7b59adb60779",
      },
    },
    {
      fullUrl: "urn:uuid:2745d583-e3d1-3f88-8b21-7b59adb60779",
      resource: {
        resourceType: "Encounter",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter"],
        },
        id: "2745d583-e3d1-3f88-8b21-7b59adb60779",
      },
    },
  ],
};

var defaultGuidBundle = {
  resourceType: "Bundle",
  type: "batch",
  entry: [
    {
      fullUrl: "urn:uuid:40386838-40ff-3f80-b68b-4904de7e7b7b",
      resource: {
        resourceType: "Composition",
        id: "40386838-40ff-3f80-b68b-4904de7e7b7b",
        identifier: {
          use: "official",
          value: "2.16.840.1.113883.19.5.99999.1",
        },
      },
    },
    {
      fullUrl: "urn:uuid:4cfe8d6d-3fc8-3e41-b921-f204be18db31",
      resource: {
        resourceType: "Patient",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
        },
        id: "4cfe8d6d-3fc8-3e41-b921-f204be18db31",
      },
    },
  ],
};

describe("testRule", function () {
  it("Rule fhirR4Validation should return a object with valid status and empty string when the bundle is a standard FHIR-R4 data", function () {
    var resJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../test-samples/FHIR-R4/sample1.json"))
    );
    assert.strictEqual(testRules.fhirR4Validation(null, resJson).valid, true);
    assert.strictEqual(testRules.fhirR4Validation(null, resJson).errorMessage, "");
  });

  it("Rule fhirR4Validation should return a object with invalid status and error message when the bundle is not a standard FHIR-R4 data", function () {
    assert.strictEqual(testRules.fhirR4Validation(null, onePatientBundle).valid, false);
    assert.strictEqual(
      JSON.parse(testRules.fhirR4Validation(null, onePatientBundle).errorMessage).valid,
      false
    );
  });

  it("Rule onePatient should return a object with valid status and empty string when there is one Patient resourse", function () {
    assert.strictEqual(testRules.onePatient(null, onePatientBundle).valid, true);
    assert.strictEqual(testRules.onePatient(null, onePatientBundle).errorMessage, "");
  });

  it("Rule onePatient should return a object with invalid status and error message when there are more than one Patient resourse", function () {
    assert.strictEqual(testRules.onePatient(null, twoPatientSameGuidBundle).valid, false);
    assert.strictEqual(
      testRules.onePatient(null, twoPatientSameGuidBundle).errorMessage,
      "The bundle contains 2 Patient resources"
    );
  });

  it("Rule noDefaultGuid should return a object with valid status and empty string when there is no default Guid", function () {
    assert.strictEqual(testRules.noDefaultGuid(null, onePatientBundle).valid, true);
    assert.strictEqual(testRules.noDefaultGuid(null, onePatientBundle).errorMessage, "");
  });

  it("Rule noDefaultGuid should return a object with invalid status and error message when there is default Guid", function () {
    assert.strictEqual(testRules.noDefaultGuid(null, defaultGuidBundle).valid, false);
    assert.strictEqual(
      testRules.noDefaultGuid(null, defaultGuidBundle).errorMessage,
      "The bundle contains 1 default Guid(s) 4cfe8d6d-3fc8-3e41-b921-f204be18db31"
    );
  });

  it("Rule noSameGuid should return a object with valid status and empty string when there is no duplicate Guid", function () {
    assert.strictEqual(testRules.noSameGuid(null, onePatientBundle).valid, true);
    assert.strictEqual(testRules.noSameGuid(null, onePatientBundle).errorMessage, "");
    assert.strictEqual(testRules.noSameGuid(null, patientEncounterSameGuidBundle).valid, true);
    assert.strictEqual(testRules.noSameGuid(null, patientEncounterSameGuidBundle).errorMessage, "");
  });

  it("Rule noSameGuid should return a object with invalid status and error message when there are duplicate Guids", function () {
    assert.strictEqual(testRules.noSameGuid(null, twoPatientSameGuidBundle).valid, false);
    assert.strictEqual(
      testRules.noSameGuid(null, twoPatientSameGuidBundle).errorMessage,
      "The bundle contains some duplicate Guids: Patient/2745d583-e3d1-3f88-8b21-7b59adb60779"
    );
  });

  it("Rule originValueReveal should return an object with valid status and empty string when all the values can be traced.", () => {
    const input = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../test-samples/FHIR-R4/sample2.json"))
    );
    const reqJson = {
      templateBase64: null,
      srcDataBase64: null,
      messagev2: input.sourceData,
    };
    const resJson = input.conversionResult;
    assert.ok(testRules.originValueReveal(reqJson, resJson).valid);
  });

  it("Rule originValueReveal should return an object with invalid status and error message when some values can't be traced.", () => {
    const input = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../test-samples/FHIR-R4/sample2.json"))
    );
    const reqJson = {
      templateBase64: null,
      srcDataBase64: null,
      messagev2: input.sourceData,
    };
    const resJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../test-samples/FHIR-R4/sample1.json"))
    );
    const result = testRules.originValueReveal(reqJson, resJson);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorMessage, "Some properties can't be found in the origin data.");
  });

  it("Rule originValueReveal should return an object with invalid status and error message when the resource is too deep.", () => {
    const reqJson = {
      templateBase64: null,
      srcDataBase64: null,
      messagev2: commonUtils.createDeepObject(128, false),
    };
    const resJson = commonUtils.createDeepObject(128, true);
    const result = testRules.originValueReveal(reqJson, resJson);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorMessage, "Error: Reveal depth exceeds limit.");
  });

  it("Rule officialValidator should return an object with valid status and empty string when the resource is valid.", () => {
    const reqJson = null;
    const resJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../test-samples/FHIR-R4/sample3-right.json"))
    );
    assert.ok(testRules.officialValidator(reqJson, resJson).valid);
  }).timeout(300 * 1000);

  it("Rule officialValidator should return an object with invalid status and error message when the resource is invalid.", () => {
    const reqJson = null;
    const resJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../test-samples/FHIR-R4/sample3-wrong.json"))
    );
    const result = testRules.officialValidator(reqJson, resJson);

    const errorMessage =
      "Fatal @ (document) : Error parsing JSON: Error parsing JSON source: JSON syntax error - found Close expecting String at Line 1 (path=[/null])";
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.errorMessage, errorMessage);
  }).timeout(300 * 1000);
});
