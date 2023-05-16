// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const supertest = require("supertest");
const express = require("express");
var fs = require("fs");
var path = require("path");
var constants = require("../../../src/lib/constants/constants");
const API_KEY_HEADER = "X-MS-CONVERSION-API-KEY";
const apiKeys = ["123", "456"];
var app = require("../../../src/routes")(express());

// load testcases
var cdaTestcases = require("./config/testcases-cda")();
var hl7v2Testcases = require("./config/testcases-hl7v2")();
var opTests = cdaTestcases.concat(hl7v2Testcases);

describe("E2E test - FHIR data validation", function () {
  before(function () {
    app.setValidApiKeys(apiKeys);
  });

  opTests.forEach(t => {
    it(
      "should output a valid FHIR data with " + t.dataFile + " and " + t.templateFile,
      function (done) {
        var dataType = path.extname(t.dataFile);
        var endpointURL = "";
        var templateLocation = "";
        var dataLocation = "";
        var requestJson = {
          templateBase64: "",
          srcDataBase64: "",
        };

        if (dataType === ".hl7") {
          endpointURL = "/api/convert/hl7v2";
          templateLocation = constants.HL7V2_TEMPLATE_LOCATION;
          dataLocation = constants.HL7V2_DATA_LOCATION;
        } else if (dataType === ".cda") {
          endpointURL = "/api/convert/cda";
          templateLocation = constants.CDA_TEMPLATE_LOCATION;
          dataLocation = constants.CDA_DATA_LOCATION;
        } else {
          done(new Error("The data type (" + dataType + ") is not supported."));
        }
        requestJson.srcDataBase64 = Buffer.from(
          fs.readFileSync(path.join(dataLocation, t.dataFile))
        ).toString("base64");
        requestJson.templateBase64 = Buffer.from(
          fs.readFileSync(path.join(templateLocation, t.templateFile))
        ).toString("base64");

        supertest(app)
          .post(endpointURL)
          .set(API_KEY_HEADER, apiKeys[0])
          .send(requestJson)
          .expect(200)
          .expect(response => {
            t.testRules.every(testRule => {
              var result = testRule(requestJson, response.body.fhirResource);
              if (result.valid === false) {
                throw new Error(testRule.name + " validation failed.\n" + result.errorMessage);
              }
              return true;
            });
          })
          .end(err => {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
      }
    ).timeout(30000);
  });
});
