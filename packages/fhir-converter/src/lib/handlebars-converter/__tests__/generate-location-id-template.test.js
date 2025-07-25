const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const helpers = require("../handlebars-helpers").external;
const functions = require("../handlebars-helpers").internal;

describe("GenerateLocationId.hbs template vs generateLocationId helper function", function () {
  let handlebarsInstance;
  let generateLocationIdTemplate;

  beforeAll(() => {
    handlebarsInstance = Handlebars.create();

    helpers.forEach(helper => {
      handlebarsInstance.registerHelper(helper.name, helper.func);
    });

    const templatePath = path.join(
      __dirname,
      "../../../templates/cda/Utils/GenerateLocationId.hbs"
    );
    const templateContent = fs.readFileSync(templatePath, "utf8");
    generateLocationIdTemplate = handlebarsInstance.compile(templateContent);
  });

  const renderLocationId = locationData => {
    try {
      const result = generateLocationIdTemplate({ location: locationData });
      // Clean up the templateRes by removing trailing comma and parsing JSON
      const cleanResult = result.replace(/,\s*}/g, "}").replace(/,\s*$/, "");
      return JSON.parse(cleanResult);
    } catch (error) {
      console.error("Error parsing template result");
      return undefined;
    }
  };

  describe("Location with location.location.addr (primary case)", () => {
    it("should generate UUID from location.location.addr, location.location.name, and location.code", () => {
      const locationData = {
        location: {
          addr: {
            streetAddressLine: ["123 Main St"],
            city: "Anytown",
            state: "CA",
            postalCode: "12345",
          },
          name: "General Hospital",
        },
        code: {
          code: "HOSP",
          codeSystem: "2.16.840.1.113883.5.110",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });

    it("should handle missing location.location.name and location.code", () => {
      const locationData = {
        location: {
          addr: {
            streetAddressLine: ["456 Oak Ave"],
            city: "Somewhere",
            state: "NY",
            postalCode: "67890",
          },
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });
  });

  describe("Location with location.addr (fallback case)", () => {
    it("should generate UUID from location.addr, location.playingEntity.name, and location.code", () => {
      const locationData = {
        addr: {
          streetAddressLine: ["789 Pine St"],
          city: "Elsewhere",
          state: "TX",
          postalCode: "11111",
        },
        playingEntity: {
          name: "Medical Center",
        },
        code: {
          code: "CLINIC",
          codeSystem: "2.16.840.1.113883.5.110",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });

    it("should handle missing location.playingEntity.name and location.code", () => {
      const locationData = {
        addr: {
          streetAddressLine: ["321 Elm St"],
          city: "Nowhere",
          state: "FL",
          postalCode: "22222",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });
  });

  describe("Location with location.playingEntity.name (final fallback case)", () => {
    it("should generate UUID from location.playingEntity.name when no addr", () => {
      const locationData = {
        playingEntity: {
          name: "Urgent Care Facility",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(helperRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);
    });

    it("should generate consistent UUIDs for same name data", () => {
      const locationData = {
        playingEntity: {
          name: "Consistent Facility Name",
        },
      };

      const templateRes1 = renderLocationId(locationData);
      const templateRes2 = renderLocationId(locationData);
      const helperRes1 = functions.generateLocationId(locationData);
      const helperRes2 = functions.generateLocationId(locationData);

      expect(templateRes1.Id).toBe(templateRes2.Id);
      expect(helperRes1).toBe(helperRes2);
      expect(templateRes1.Id).toBe(helperRes1);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty location object", () => {
      const locationData = {};

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toEqual({});
      expect(templateRes).toEqual(helperRes);
    });

    it("should handle null location", () => {
      const locationData = null;

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toEqual({});
      expect(templateRes).toEqual(helperRes);
    });
  });

  describe("Priority handling", () => {
    it("should prioritize location.location.addr over location.addr when both exist", () => {
      const locationData = {
        location: {
          addr: {
            streetAddressLine: ["Priority Address"],
            city: "Priority City",
          },
          name: "Priority Facility",
        },
        addr: {
          streetAddressLine: ["Should Be Ignored"],
          city: "Ignored City",
        },
        playingEntity: {
          name: "Should Also Be Ignored",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);

      const addrOnlyData = {
        addr: {
          streetAddressLine: ["Should Be Ignored"],
          city: "Ignored City",
        },
        playingEntity: {
          name: "Should Also Be Ignored",
        },
      };
      const addrOnlyResult = functions.generateLocationId(addrOnlyData);
      expect(templateRes.Id).not.toBe(addrOnlyResult);
    });

    it("should prioritize location.addr over location.playingEntity.name when both exist", () => {
      const locationData = {
        addr: {
          streetAddressLine: ["Secondary Priority"],
          city: "Secondary City",
        },
        playingEntity: {
          name: "Should Be Ignored",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);

      const nameOnlyData = {
        playingEntity: {
          name: "Should Be Ignored",
        },
      };
      const nameOnlyResult = functions.generateLocationId(nameOnlyData);
      expect(templateRes.Id).not.toBe(nameOnlyResult);
    });
  });

  describe("Integration with helper functions", () => {
    it("should use generateUUID helper correctly", () => {
      const locationData = {
        location: {
          addr: {
            streetAddressLine: ["UUID Test Address"],
            city: "UUID City",
          },
          name: "UUID Test Facility",
        },
        code: {
          code: "TEST",
          codeSystem: "2.16.840.1.113883.5.110",
        },
      };

      const combined = [
        JSON.stringify(locationData.location.addr),
        JSON.stringify(locationData.location.name),
        JSON.stringify(locationData.code),
      ].join("");
      const expectedUuid = require("uuid/v3")(combined, require("uuid/v3").URL);

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes.Id).toBe(expectedUuid);
      expect(helperRes).toBe(expectedUuid);
      expect(templateRes.Id).toBe(helperRes);
    });

    it("should use concatDefined helper correctly for address-based generation", () => {
      const locationData = {
        addr: {
          streetAddressLine: ["Concat Test"],
          city: "Concat City",
        },
        playingEntity: {
          name: "Concat Facility",
        },
        code: {
          code: "CONCAT",
          codeSystem: "2.16.840.1.113883.5.110",
        },
      };

      const templateRes = renderLocationId(locationData);
      const helperRes = functions.generateLocationId(locationData);

      expect(templateRes).toBeDefined();
      expect(templateRes.Id).toBe(helperRes);

      const expectedCombined = [
        JSON.stringify(locationData.addr),
        JSON.stringify(locationData.playingEntity.name),
        JSON.stringify(locationData.code),
      ].join("");
      const expectedUuid = require("uuid/v3")(expectedCombined, require("uuid/v3").URL);

      expect(templateRes.Id).toBe(expectedUuid);
    });
  });

  describe("Template structure validation", () => {
    it("should produce valid JSON structure", () => {
      const locationData = {
        location: {
          addr: {
            streetAddressLine: ["Structure Test"],
            city: "Structure City",
          },
          name: "Structure Facility",
        },
      };

      const templateRes = renderLocationId(locationData);

      expect(() => JSON.stringify(templateRes)).not.toThrow();
      expect(typeof templateRes).toBe("object");
      expect(templateRes).not.toBeNull();
      expect(templateRes).toHaveProperty("Id");
    });

    it("should handle template compilation without errors", () => {
      expect(() => {
        const templatePath = path.join(
          __dirname,
          "../../../templates/cda/Utils/GenerateLocationId.hbs"
        );
        const templateContent = fs.readFileSync(templatePath, "utf8");
        handlebarsInstance.compile(templateContent);
      }).not.toThrow();
    });
  });
});
