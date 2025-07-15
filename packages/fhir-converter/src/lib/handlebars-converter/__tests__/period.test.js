const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const helpers = require("../handlebars-helpers").external;
const functions = require("../handlebars-helpers").internal;

describe("Period.hbs template vs buildPeriod helper tests", function () {
  let handlebarsInstance;
  let periodTemplate;

  beforeAll(() => {
    handlebarsInstance = Handlebars.create();

    helpers.forEach(helper => {
      handlebarsInstance.registerHelper(helper.name, helper.func);
    });

    const templatePath = path.join(__dirname, "../../../templates/cda/DataType/Period.hbs");
    const templateContent = fs.readFileSync(templatePath, "utf8");
    periodTemplate = handlebarsInstance.compile(templateContent);
  });

  const renderPeriod = periodData => {
    const result = periodTemplate({ period: periodData });
    // Clean up the templateRes by removing trailing comma and parsing JSON
    const cleanResult = result.replace(/,\s*}/g, "}").replace(/,\s*$/, "");
    return JSON.parse(cleanResult);
  };

  describe("Valid period with both low and high dates (start <= end)", () => {
    it("should render both start and end dates when low <= high", () => {
      const periodData = {
        low: { value: "20240101" },
        high: { value: "20240131" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes.start).toBe("2024-01-01T00:00:00.000Z");
      expect(templateRes.end).toBe("2024-01-31T00:00:00.000Z");
    });

    it("should render both start and end dates when low equals high", () => {
      const periodData = {
        low: { value: "20240115" },
        high: { value: "20240115" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes.start).toBe("2024-01-15T00:00:00.000Z");
      expect(templateRes.end).toBe("2024-01-15T00:00:00.000Z");
    });

    it("should handle datetime values with time components", () => {
      const periodData = {
        low: { value: "20240101120000" },
        high: { value: "20240101180000" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes.start).toBe("2024-01-01T12:00:00.000Z");
      expect(templateRes.end).toBe("2024-01-01T18:00:00.000Z");
    });
  });

  describe("Invalid period with low > high", () => {
    it("should render only start date when low > high", () => {
      const periodData = {
        low: { value: "20240131" },
        high: { value: "20240101" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes.start).toBe("2024-01-31T00:00:00.000Z");
    });
  });

  describe("Period with only low date", () => {
    it("should render only start date when only low is provided", () => {
      const periodData = {
        low: { value: "20240115" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes).not.toHaveProperty("end");
      expect(templateRes.start).toBe("2024-01-15T00:00:00.000Z");
    });
  });

  describe("Period with only high date", () => {
    it("should render only end date when only high is provided", () => {
      const periodData = {
        high: { value: "20240131" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes).not.toHaveProperty("start");
      expect(templateRes.end).toBe("2024-01-31T00:00:00.000Z");
    });
  });

  describe("Period with only value (fallback case)", () => {
    it("should render start date from period.value when no low/high", () => {
      const periodData = {
        value: "20240115",
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes).not.toHaveProperty("end");
      expect(templateRes.start).toBe("2024-01-15T00:00:00.000Z");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty period object", () => {
      const periodData = {};

      const templateRes = renderPeriod(periodData);

      expect(templateRes).not.toHaveProperty("end");
      expect(templateRes).toHaveProperty("start");
      expect(templateRes.start).toBe("");
    });

    it("should handle null period", () => {
      const periodData = null;

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes).toHaveProperty("start");
      expect(templateRes.start).toBe("");
    });

    it("should handle invalid date formats gracefully", () => {
      const periodData = {
        low: { value: "invalid-date" },
        high: { value: "20240131" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes).not.toHaveProperty("end");
      expect(templateRes).toHaveProperty("start");
      expect(templateRes.start).toBe("");
    });

    it("should handle dates before 1900", () => {
      const periodData = {
        low: { value: "18991231" },
        high: { value: "20240131" },
      };

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes).toHaveProperty("start");
      expect(templateRes).not.toHaveProperty("end");
      expect(templateRes.start).toBe("");
    });
  });

  describe("Integration with helper functions", () => {
    it("should use formatAsDateTime helper correctly", () => {
      const periodData = {
        low: { value: "20240101120000" },
        high: { value: "20240101180000" },
      };

      // Test the helper function directly
      const formattedLow = functions.getDateTime("20240101120000");
      const formattedHigh = functions.getDateTime("20240101180000");

      expect(formattedLow).toBe("2024-01-01T12:00:00.000Z");
      expect(formattedHigh).toBe("2024-01-01T18:00:00.000Z");

      const templateRes = renderPeriod(periodData);
      const helperRes = functions.buildPeriod(periodData);

      expect(templateRes).toEqual(helperRes);
      expect(templateRes.start).toBe(formattedLow);
      expect(templateRes.end).toBe(formattedHigh);
    });

    it("should use startDateLteEndDate helper correctly", () => {
      // Test the helper function directly
      const validPeriod = functions.startDateLteEndDate("20240101", "20240131");
      const invalidPeriod = functions.startDateLteEndDate("20240131", "20240101");
      const equalDates = functions.startDateLteEndDate("20240115", "20240115");

      expect(validPeriod).toBe(true);
      expect(invalidPeriod).toBe(false);
      expect(equalDates).toBe(true);
    });
  });

  describe("Template structure validation", () => {
    it("should produce valid JSON structure", () => {
      const periodData = {
        low: { value: "20240101" },
        high: { value: "20240131" },
      };

      const templateRes = renderPeriod(periodData);

      // Verify the structure is valid JSON
      expect(() => JSON.stringify(templateRes)).not.toThrow();

      // Verify it has the expected properties
      expect(typeof templateRes).toBe("object");
      expect(templateRes).not.toBeNull();
    });

    it("should handle template compilation without errors", () => {
      expect(() => {
        const templatePath = path.join(__dirname, "../../../templates/cda/DataType/Period.hbs");
        const templateContent = fs.readFileSync(templatePath, "utf8");
        handlebarsInstance.compile(templateContent);
      }).not.toThrow();
    });
  });
});
