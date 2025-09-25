import { isValidParameter, isValidLookupParametersResource } from "../parameters";

describe("parameters utils", () => {
  describe("isValidParameter", () => {
    it("returns true for valid code parameter", () => {
      const param = {
        name: "code",
        valueCode: "123",
      };
      expect(isValidParameter(param)).toBe(true);
    });

    it("returns true for valid system parameter", () => {
      const param = {
        name: "system",
        valueUri: "http://snomed.info/sct",
      };
      expect(isValidParameter(param)).toBe(true);
    });

    it("returns false for parameter without name", () => {
      const param = {
        valueUri: "123",
      };
      expect(isValidParameter(param)).toBe(false);
    });

    it("returns false for parameter without value", () => {
      const param = {
        name: "code",
      };
      expect(isValidParameter(param)).toBe(false);
    });

    it("returns false for parameter with invalid value type", () => {
      const param = {
        name: "code",
        valueBoolean: true,
      };
      expect(isValidParameter(param)).toBe(false);
    });
  });

  describe("isValidParametersResource", () => {
    it("returns true for valid Parameters resource", () => {
      const resource = {
        resourceType: "Parameters",
        id: "abcd-1234",
        parameter: [
          {
            name: "code",
            valueCode: "123",
          },
          {
            name: "system",
            valueUri: "http://snomed.info/sct",
          },
        ],
      };
      expect(isValidLookupParametersResource(resource)).toBe(true);
    });

    it("returns false for Parameters resource without id", () => {
      const resource = {
        resourceType: "Parameters",
        parameter: [
          {
            name: "code",
            valueCode: "123",
          },
          {
            name: "system",
            valueUri: "http://snomed.info/sct",
          },
        ],
      };
      expect(isValidLookupParametersResource(resource)).toBe(false);
    });

    it("returns false for resource with wrong resourceType", () => {
      const resource = {
        resourceType: "Patient",
        parameter: [
          {
            name: "code",
            valueCode: "123",
          },
        ],
      };
      expect(isValidLookupParametersResource(resource)).toBe(false);
    });

    it("returns false for resource without parameters", () => {
      const resource = {
        resourceType: "Parameters",
      };
      expect(isValidLookupParametersResource(resource)).toBe(false);
    });

    it("returns false for resource with empty parameters array", () => {
      const resource = {
        resourceType: "Parameters",
        parameter: [],
      };
      expect(isValidLookupParametersResource(resource)).toBe(false);
    });

    it("returns false for resource with invalid parameter", () => {
      const resource = {
        resourceType: "Parameters",
        parameter: [
          {
            name: "code",
            valueCode: "123",
          },
          {
            // Missing name
            valueUri: "http://snomed.info/sct",
          },
        ],
      };
      expect(isValidLookupParametersResource(resource)).toBe(false);
    });
  });
});
