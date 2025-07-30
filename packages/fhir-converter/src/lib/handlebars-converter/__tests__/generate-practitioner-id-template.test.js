const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const helpers = require("../handlebars-helpers").external;
const functions = require("../handlebars-helpers").internal;

describe("GeneratePractitionerId.hbs template vs generatePractitionerId helper function", function () {
  let handlebarsInstance;
  let generatePractitionerIdTemplate;

  beforeAll(() => {
    handlebarsInstance = Handlebars.create();

    helpers.forEach(helper => {
      handlebarsInstance.registerHelper(helper.name, helper.func);
    });

    const templatePath = path.join(
      __dirname,
      "../../../templates/cda/Utils/GeneratePractitionerId.hbs"
    );
    const templateContent = fs.readFileSync(templatePath, "utf8");
    generatePractitionerIdTemplate = handlebarsInstance.compile(templateContent);
  });

  const renderPractitionerId = practitionerData => {
    try {
      const result = generatePractitionerIdTemplate({ obj: practitionerData });
      // Clean up the templateRes by removing trailing comma and parsing JSON
      const cleanResult = result.replace(/,\s*}/g, "}").replace(/,\s*$/, "");
      return JSON.parse(cleanResult);
    } catch (error) {
      return undefined;
    }
  };

  describe("Practitioner with both root and extension IDs", () => {
    it("should generate UUID from root and extension when both exist", () => {
      const practitionerData = {
        id: [
          {
            root: "2.16.840.1.113883.19.5",
            extension: "12345",
          },
        ],
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });

    it("should handle single ID object (not array)", () => {
      const practitionerData = {
        id: {
          root: "2.16.840.1.113883.19.5",
          extension: "67890",
        },
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });
  });

  describe("Practitioner with no ID field", () => {
    it("should not generate UUID when no id field exists, even with assignedPerson.name", () => {
      const practitionerData = {
        assignedPerson: {
          name: {
            given: ["John"],
            family: "Doe",
          },
        },
        addr: {
          streetAddressLine: ["123 Main St"],
          city: "Anytown",
          state: "CA",
          postalCode: "12345",
        },
        telecom: [
          {
            value: "tel:+1-555-123-4567",
          },
        ],
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeUndefined();
      expect(helperRes).toBeUndefined();
    });
  });

  describe("Practitioner with ID field but invalid root/extension - fallback to name", () => {
    it("should fall back to name-based generation when ID exists but missing root", () => {
      const practitionerData = {
        id: [
          {
            extension: "12345",
          },
        ],
        assignedPerson: {
          name: {
            given: ["Should"],
            family: "BeUsed",
          },
        },
        addr: {
          city: "SomeCity",
        },
        telecom: [
          {
            value: "tel:+1-555-999-9999",
          },
        ],
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
      expect(typeof templateRes.Id).toBe("string");
    });

    it("should fall back to name-based generation when ID exists but missing extension", () => {
      const practitionerData = {
        id: [
          {
            root: "2.16.840.1.113883.19.5",
          },
        ],
        assignedPerson: {
          name: {
            given: ["Should"],
            family: "BeUsed",
          },
        },
        addr: {
          city: "SomeCity",
        },
        telecom: [
          {
            value: "tel:+1-555-999-9999",
          },
        ],
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
      expect(typeof templateRes.Id).toBe("string");
    });

    it("should generate consistent UUIDs for same name data when falling back", () => {
      const practitionerData = {
        id: [
          {
            root: "2.16.840.1.113883.19.5",
          },
        ],
        assignedPerson: {
          name: {
            given: ["Consistent"],
            family: "Name",
          },
        },
        addr: {
          city: "SomeCity",
        },
        telecom: [
          {
            value: "tel:+1-555-999-9999",
          },
        ],
      };

      const templateRes1 = renderPractitionerId(practitionerData);
      const templateRes2 = renderPractitionerId(practitionerData);
      const helperRes1 = functions.generatePractitionerId(practitionerData);
      const helperRes2 = functions.generatePractitionerId(practitionerData);

      expect(templateRes1.Id).toBe(templateRes2.Id);
      expect(helperRes1).toBe(helperRes2);
      expect(templateRes1.Id).toBe(helperRes1);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty practitioner object", () => {
      const practitionerData = {};

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeUndefined();
      expect(helperRes).toBeUndefined();
    });

    it("should handle null practitioner", () => {
      const practitionerData = null;

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeUndefined();
      expect(helperRes).toBeUndefined();
    });

    it("should handle undefined practitioner", () => {
      const practitionerData = undefined;

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeUndefined();
      expect(helperRes).toBeUndefined();
    });

    it("should handle assignedPerson without name", () => {
      const practitionerData = {
        assignedPerson: {},
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeUndefined();
      expect(helperRes).toBeUndefined();
    });
  });

  describe("Priority handling", () => {
    it("should prioritize root/extension over assignedPerson when both exist", () => {
      const practitionerData = {
        id: [
          {
            root: "2.16.840.1.113883.19.5",
            extension: "priority-test",
          },
        ],
        assignedPerson: {
          name: {
            given: ["Should"],
            family: "BeIgnored",
          },
        },
      };

      const templateRes = renderPractitionerId(practitionerData);
      const helperRes = functions.generatePractitionerId(practitionerData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);

      const nameBasedData = {
        assignedPerson: {
          name: {
            given: ["Should"],
            family: "BeIgnored",
          },
        },
      };
      const nameBasedResult = functions.generatePractitionerId(nameBasedData);
      expect(templateRes.Id).not.toBe(nameBasedResult);
      expect(nameBasedResult).toBeUndefined();
    });
  });

  describe("Template structure validation", () => {
    it("should handle template compilation without errors", () => {
      expect(() => {
        const templatePath = path.join(
          __dirname,
          "../../../templates/cda/Utils/GeneratePractitionerId.hbs"
        );
        const templateContent = fs.readFileSync(templatePath, "utf8");
        handlebarsInstance.compile(templateContent);
      }).not.toThrow();
    });
  });
});
