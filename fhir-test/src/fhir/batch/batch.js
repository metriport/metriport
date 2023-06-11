// Based on: https://github.com/artilleryio/artillery/issues/791#issuecomment-578592350
const fs = require("fs");
const { faker } = require("@faker-js/faker");

const pathBase = `${__dirname}`;
const pathLoad = `${pathBase}/payload-load`;

/**
 * Generates post body from random file
 */
const makeBodyRandom = async (userContext, events, done) => {
  try {
    const files = fs.readdirSync(pathLoad);
    console.log(`Found ${files.legnth} files`);
    const chosenFile = faker.helpers.arrayElement(files);
    // add variables to virtual user's context:
    const fileContents = fs.readFileSync(pathLoad + "/" + chosenFile, "utf8");
    userContext.vars.requestBody = JSON.parse(fileContents);
    userContext.vars.requestFile = chosenFile;
    // continue with executing the scenario:
    return done();
  } catch (err) {
    console.log(`Error occurred in function makeBodyRandom. Detail: ${err}`);
    throw err;
  }
};

const checkOperationOutcomes = (requestParams, response, context, ee, next) => {
  console.log(
    `Checking OperationOutcome on response; status is ${
      response.status ?? response.statusCode
    }, body length is ${response.body.length}`
  );
  try {
    const body = JSON.parse(response.body);
    const errors = body.entry.filter(e => !e.response.status.startsWith("2"));
    const successes = body.entry.filter(e => e.response.status.startsWith("2"));
    console.log(`Errors: ${errors.length}, Successes: ${successes.length}`);

    const resources = successes.map(e => e.resource);
    const getId = (resourceType, idx = 0) =>
      resources.filter(r => r.resourceType === resourceType)[idx]?.id;
    const patient = getId("Patient");
    const practitioner = getId("Practitioner");
    const device = getId("Device");
    const medicationStatement = getId("MedicationStatement");
    const medication = getId("Medication");
    const allergyIntolerance = getId("AllergyIntolerance");
    const encounter = getId("Encounter");
    const condition = getId("Condition");
    const observation = getId("Observation");
    const procedure = getId("Procedure");
    const immunization = getId("Immunization");
    const diagnosticReport = getId("DiagnosticReport");
    const documentReference = getId("DocumentReference");
    const claim = getId("Claim");
    const explanationOfBenefit = getId("ExplanationOfBenefit");
    context.vars.ids = {
      patient,
      practitioner,
      device,
      medicationStatement,
      medication,
      allergyIntolerance,
      encounter,
      condition,
      observation,
      procedure,
      immunization,
      diagnosticReport,
      documentReference,
      claim,
      explanationOfBenefit,
    };
    if (errors.length > 0)
      return next(new Error(`Received ${errors.length} OperationOutcome errors`));
  } catch (err) {
    return next(err);
  }
  return next();
};

/**
 * Generates post body from random file
 */
const makeBodyFunctional = async (userContext, events, done) => {
  try {
    const fileName = "payload-functional.json";
    // add variables to virtual user's context:
    const fileContents = fs.readFileSync(pathBase + "/" + fileName, "utf8");
    const bundle = JSON.parse(fileContents);
    userContext.vars.requestBody = bundle;
    userContext.vars.requestFile = fileName;
    // continue with executing the scenario:
    return done();
  } catch (err) {
    console.log(`Error occurred in function makeBodyFunctional. Detail: ${err}`);
    throw err;
  }
};

module.exports = {
  makeBodyRandom,
  makeBodyFunctional,
  checkOperationOutcomes,
};
