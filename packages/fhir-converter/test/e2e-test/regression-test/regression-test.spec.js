// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const supertest = require("supertest");
const express = require("express");
const fs = require("fs");
const path = require("path");
const routes = require("../../../src/routes");
const constants = require("../../../src/lib/constants/constants");
const cases = require("./config");
const utils = require("./util/utils");

const MAX_TEST_TIME = 10000;
const API_KEY_HEADER = "X-MS-CONVERSION-API-KEY";
const API_KEY = "this_is_a_fake_app_key";

describe("Regression test - FHIR data validation", () => {
  const app = routes(express());
  const allCases = cases.cdaCases.concat(cases.hl7v2Cases);
  before(() => app.setValidApiKeys([API_KEY]));

  allCases.forEach(subCase => {
    it(`should output a valid FHIR data with ${subCase.dataFile} and ${subCase.templateFile}`, done => {
      const dataType = path.extname(subCase.dataFile);
      const meta = {
        ".cda": [
          "/api/convert/cda",
          constants.CDA_TEMPLATE_LOCATION,
          constants.CDA_DATA_LOCATION,
          "cda",
        ],
        ".hl7": [
          "/api/convert/hl7v2",
          constants.HL7V2_TEMPLATE_LOCATION,
          constants.HL7V2_DATA_LOCATION,
          "hl7v2",
        ],
      };

      if (!Object.keys(meta).includes(dataType)) {
        return done(new Error(`The data type (${dataType}) is not supported.`));
      }

      const endpointURL = meta[dataType][0];
      const templateLocation = meta[dataType][1];
      const dataLocation = meta[dataType][2];
      const groundTruthLocation = path.join(
        __dirname,
        `./data/${meta[dataType][3]}`,
        subCase.templateFile
      );

      const templateFilePath = path.join(templateLocation, subCase.templateFile);
      const srcDataFilePath = path.join(dataLocation, subCase.dataFile);
      const groundTruthFilePath = path.join(
        groundTruthLocation,
        utils.getGroundTruthFileName(subCase)
      );
      const payload = {
        templateBase64: Buffer.from(fs.readFileSync(templateFilePath)).toString("base64"),
        srcDataBase64: Buffer.from(fs.readFileSync(srcDataFilePath)).toString("base64"),
      };

      supertest(app)
        .post(endpointURL)
        .set(API_KEY_HEADER, API_KEY)
        .send(payload)
        .expect(200)
        .expect(response => {
          const groundTruth = fs.existsSync(groundTruthFilePath)
            ? fs.readFileSync(groundTruthFilePath, "utf8")
            : "{}";
          // TODO: the `unusedSegments` & `invalidAccess` still need to be tested
          const result = JSON.stringify(response.body.fhirResource);
          utils.compareContent(result, groundTruth);
          return true;
        })
        .end(done);
    }).timeout(MAX_TEST_TIME);
  });
});
