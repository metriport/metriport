const fs = require("fs");
const path = require("path");
const { createNamespace, getNamespace } = require("cls-hooked");
const HandlebarsConverter = require("../handlebars-converter");
const dataHandlerFactory = require("../../dataHandler/dataHandlerFactory");
const jsonProcessor = require("../../outputProcessor/jsonProcessor");
const constants = require("../../constants/constants");

const CDA_TEMPLATES_FOLDER = path.join(constants.BASE_TEMPLATE_FILES_LOCATION, "cda");

describe("communication.preferred should be a boolean (true/false), not a string", function () {
  let handlebarsInstance;
  let patientTemplate;
  let relatedPersonTemplate;
  let session;

  beforeAll(() => {
    const cdaDataHandler = dataHandlerFactory.createDataHandler("cda");
    handlebarsInstance = HandlebarsConverter.instance(true, cdaDataHandler, CDA_TEMPLATES_FOLDER);

    patientTemplate = loadTemplate("Resources/Patient.hbs");
    relatedPersonTemplate = loadTemplate("Resources/RelatedPerson.hbs");

    // Some helpers used by the templates read shared state from a "session".
    // The real converter creates one per request, so we create one here too.
    session = getNamespace(constants.CLS_NAMESPACE) || createNamespace(constants.CLS_NAMESPACE);
  });

  function loadTemplate(templateName) {
    const templatePath = path.join(CDA_TEMPLATES_FOLDER, templateName);
    const templateContent = fs.readFileSync(templatePath, "utf8");
    return handlebarsInstance.compile(templateContent);
  }

  // Runs a template with the given data and returns the resulting FHIR resource as an object.
  function runTemplate(template, data) {
    return session.runAndReturn(() => {
      session.set(constants.CLS_KEY_HANDLEBAR_INSTANCE, handlebarsInstance);
      session.set(constants.CLS_KEY_TEMPLATE_LOCATION, CDA_TEMPLATES_FOLDER);

      const templateOutput = template(data);
      // Clean up the output (trailing commas, empty fields) the same way the real converter does
      const cleanedOutput = jsonProcessor.Process(templateOutput);
      return JSON.parse(cleanedOutput).resource;
    });
  }

  // Builds one language entry, same shape as the CCDA XML:
  function buildLanguage(preferenceInd) {
    return {
      languageCode: { code: "eng" },
      preferenceInd: preferenceInd,
    };
  }

  // Returns the "preferred" value of the first language on the converted Patient
  function getPatientPreferred(preferenceInd) {
    const data = {
      ID: "patient-1",
      patientRole: {
        patient: {
          languageCommunication: buildLanguage(preferenceInd),
        },
      },
    };
    const patient = runTemplate(patientTemplate, data);
    return patient.communication[0].preferred;
  }

  // Returns the "preferred" value of the first language on the converted RelatedPerson
  function getRelatedPersonPreferred(preferenceInd) {
    const data = {
      ID: "related-person-1",
      relatedPerson: {
        guardianPerson: {
          languageCommunication: buildLanguage(preferenceInd),
        },
      },
    };
    const relatedPerson = runTemplate(relatedPersonTemplate, data);
    return relatedPerson.communication[0].preferred;
  }

  describe("Patient.hbs", () => {
    it("converts 'true' to boolean true", () => {
      expect(getPatientPreferred({ value: "true" })).toBe(true);
    });

    it("converts 'false' to boolean false", () => {
      expect(getPatientPreferred({ value: "false" })).toBe(false);
    });

    it("converts 'TRUE' to boolean true (case-insensitive)", () => {
      expect(getPatientPreferred({ value: "TRUE" })).toBe(true);
    });

    it("converts 'FALSE' to boolean false (case-insensitive)", () => {
      expect(getPatientPreferred({ value: "FALSE" })).toBe(false);
    });

    it("leaves preferred out when the value is '1' (not valid per spec)", () => {
      expect(getPatientPreferred({ value: "1" })).toBeUndefined();
    });

    it("leaves preferred out when the value is junk", () => {
      expect(getPatientPreferred({ value: "yes" })).toBeUndefined();
    });

    it("leaves preferred out when there is a nullFlavor instead of a value", () => {
      expect(getPatientPreferred({ nullFlavor: "UNK" })).toBeUndefined();
    });

    it("leaves preferred out when preferenceInd is missing", () => {
      expect(getPatientPreferred(undefined)).toBeUndefined();
    });

    it("handles multiple languages separately", () => {
      const data = {
        ID: "patient-1",
        patientRole: {
          patient: {
            languageCommunication: [
              buildLanguage({ value: "true" }),
              buildLanguage({ value: "false" }),
            ],
          },
        },
      };
      const patient = runTemplate(patientTemplate, data);

      expect(patient.communication[0].preferred).toBe(true);
      expect(patient.communication[1].preferred).toBe(false);
    });
  });

  describe("RelatedPerson.hbs", () => {
    it("converts 'true' to boolean true", () => {
      expect(getRelatedPersonPreferred({ value: "true" })).toBe(true);
    });

    it("converts 'false' to boolean false", () => {
      expect(getRelatedPersonPreferred({ value: "false" })).toBe(false);
    });

    it("converts 'TRUE' to boolean true (case-insensitive)", () => {
      expect(getRelatedPersonPreferred({ value: "TRUE" })).toBe(true);
    });

    it("converts 'FALSE' to boolean false (case-insensitive)", () => {
      expect(getRelatedPersonPreferred({ value: "FALSE" })).toBe(false);
    });

    it("leaves preferred out when the value is '1' (not valid per spec)", () => {
      expect(getRelatedPersonPreferred({ value: "1" })).toBeUndefined();
    });

    it("leaves preferred out when the value is junk", () => {
      expect(getRelatedPersonPreferred({ value: "yes" })).toBeUndefined();
    });

    it("leaves preferred out when there is a nullFlavor instead of a value", () => {
      expect(getRelatedPersonPreferred({ nullFlavor: "UNK" })).toBeUndefined();
    });

    it("leaves preferred out when preferenceInd is missing", () => {
      expect(getRelatedPersonPreferred(undefined)).toBeUndefined();
    });
  });
});
