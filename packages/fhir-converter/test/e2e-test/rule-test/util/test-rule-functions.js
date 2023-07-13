// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var testUtils = require("./utils");
var fhirModule = require("fhir");
var fhir = new fhirModule.Fhir();
const _ = require("lodash");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const fsExtra = require("fs-extra");
const systemExec = require("child_process").execSync;

const MAX_REVEAL_DEPTH = 100;
const NON_COMPARE_PROPERTY = new Set([
  "resourceType",
  "type",
  "fullUrl",
  "id",
  "method",
  "url",
  "reference",
  "system",
  "code",
  "display",
  "gender",
  "use",
  "preferred",
  "status",
  "mode",
]);

var response = function (status, message = "", reqJson = null, resJson = null) {
  return { valid: status, errorMessage: message, reqJson, resJson };
};

var fhirR4Validation = function (reqJson, resJson) {
  var result = fhir.validate(resJson);
  if (!result.valid) return response(false, JSON.stringify(result, null, "\t"));
  return response(true, "", reqJson, resJson);
};

var onePatient = function (reqJson, resJson) {
  var resources = fhir.evaluate(resJson, "Bundle.entry.resource.resourceType");
  var patientCount = testUtils.countOccurences(resources, "Patient");
  if (patientCount !== 1)
    return response(false, "The bundle contains " + patientCount + " Patient resources");
  else return response(true, "", reqJson, resJson);
};

var noDefaultGuid = function (reqJson, resJson) {
  var ids = fhir.evaluate(resJson, "Bundle.entry.resource.id");
  var defaultGuidCount = testUtils.countOccurences(ids, testUtils.defaultGuid);
  if (defaultGuidCount >= 1)
    return response(
      false,
      "The bundle contains " + defaultGuidCount + " default Guid(s) " + testUtils.defaultGuid
    );
  else return response(true, "", reqJson, resJson);
};

var noSameGuid = function (reqJson, resJson) {
  var resources = fhir.evaluate(resJson, "Bundle.entry.resource");
  var ids = [];
  for (var index in resources) {
    ids.push(resources[index].resourceType + "/" + resources[index].id);
  }
  var duplicates = testUtils.findDuplicates(ids);
  if (duplicates.length !== 0)
    return response(false, "The bundle contains some duplicate Guids: " + duplicates.toString());
  else return response(true, "", reqJson, resJson);
};

const __revealObjectValues = (target, object, level) => {
  if (level >= MAX_REVEAL_DEPTH) {
    throw new Error("Reveal depth exceeds limit.");
  }
  if (_.isObject(object)) {
    const keys = Object.keys(object).filter(key => !NON_COMPARE_PROPERTY.has(key));
    return keys.every(key => __revealObjectValues(target, object[key], level + 1));
  } else {
    const value = object.toString();
    // specially treate datetime data type
    const dateTimeRegex =
      /^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])(\s+)?T?((20|21|22|23|[0-1]\d):[0-5]\d(:[0-5]\d)?)?.*$/;
    if (dateTimeRegex.test(value)) {
      return true;
    }
    return target.includes(value);
  }
};

/**
 * Every required property value appeared in conversion result should also appear in origin data.
 * Some special data type should be treated separately (for example, "DataTime", since it has been processed by helper function).
 * TODO: But there are many property values are extended from mapping table's explicit attribute, so there need a better way.
 */
const originValueReveal = (reqJson, resJson) => {
  try {
    const flag = __revealObjectValues(JSON.stringify(reqJson), resJson, 0);
    const message = flag ? "" : "Some properties can't be found in the origin data.";
    return response(flag, message, reqJson, resJson);
  } catch (error) {
    return response(false, error.toString(), reqJson, resJson);
  }
};

/**
 * Use officially recommended validator to validate resources.
 * !!Currently the templates are still under development. By default we turn off this validator.
 */
const officialValidator = (reqJson, resJson) => {
  const javaExistCommand = "java -version";
  const validatorPath = path.join(__dirname, "../lib/validator_cli.jar");
  const specPath = path.join(__dirname, "../lib/hl7.fhir.r4.core-4.0.1.tgz");
  const resourceFolder = path.join(__dirname, "../test-samples/tmp");
  const resourcePath = path.join(resourceFolder, `${uuidv4().replace(/-/g, "")}.json`);
  const command = `java -jar ${validatorPath} ${resourcePath} -version 4.0.1 -ig ${specPath} -tx n/a`;

  fsExtra.ensureDirSync(resourceFolder);
  fsExtra.writeFileSync(resourcePath, JSON.stringify(resJson, null, 4));

  try {
    systemExec(javaExistCommand);
  } catch (error) {
    fs.unlinkSync(resourcePath);
    return response(false, error.toString(), reqJson, resJson);
  }

  let results = [],
    buffer = null;
  try {
    buffer = systemExec(command);
  } catch (error) {
    buffer = error.output[1];
  }
  const lines = buffer.toString().split(/[\n|\r|\r\n]/);
  results = results.concat(lines.map(line => line.trim()).filter(line => line.includes("Error")));
  if (results && results.length > 0) {
    fs.unlinkSync(resourcePath);
    return response(false, results.join("\n"), reqJson, resJson);
  }
  fs.unlinkSync(resourcePath);
  return response(true);
};

module.exports = {
  fhirR4Validation,
  onePatient,
  noDefaultGuid,
  noSameGuid,
  originValueReveal,
  officialValidator,
};
