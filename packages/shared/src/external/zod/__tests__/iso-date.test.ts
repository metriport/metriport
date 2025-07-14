import { isoDateSchema, ISO_DATE_REGEX, usDateSchema, US_DATE_REGEX } from "../date";

describe("date", () => {
  describe("ISO Date Regex", () => {
    describe("valid ISO dates", () => {
      const validDates = [
        "1000-01-01",
        "1900-01-01",
        "2023-01-01",
        "2023-12-31",
        "2024-02-29", // leap year
        "2023-06-15",
        "2020-03-08",
        "1999-11-30",
      ];

      test.each(validDates)("should match valid ISO date: %s", date => {
        expect(ISO_DATE_REGEX.test(date)).toBe(true);
        expect(() => isoDateSchema.parse(date)).not.toThrow();
      });
    });

    describe("invalid ISO dates", () => {
      const invalidDates = [
        "0195-01-01",
        "2023-13-01", // invalid month
        "2023-00-01", // invalid month
        "2023-01-32", // invalid day
        "2023-01-00", // invalid day
        "2023-02-30", // invalid day for February
        "2023-04-31", // invalid day for April
        "2023-1-01", // missing leading zero in month
        "2023-01-1", // missing leading zero in day
        "2023/01/01", // wrong separator
        "01-01-2023", // wrong format
        // "2023-01-01T00:00:00Z", // includes time
        // "2023-01-01 00:00:00", // includes time
        "2023-1-1", // missing leading zeros
        "23-01-01", // short year
        "2023-01", // missing day
        "2023", // missing month and day
        "", // empty string
        "invalid-date",
      ];

      test.each(invalidDates)("should not match invalid ISO date: %s", date => {
        expect(ISO_DATE_REGEX.test(date)).toBe(false);
        expect(() => isoDateSchema.parse(date)).toThrow();
      });
    });
  });

  describe("US Date Regex", () => {
    describe("valid US dates", () => {
      const validDates = [
        "01/01/2023",
        "12/31/2023",
        "02/29/2024", // leap year
        "06/15/2023",
        "03/08/2020",
        "11/30/1999",
        "01/01/2023",
        "12/31/2023",
      ];

      test.each(validDates)("should match valid US date: %s", date => {
        expect(US_DATE_REGEX.test(date)).toBe(true);
        expect(() => usDateSchema.parse(date)).not.toThrow();
      });
    });

    describe("invalid US dates", () => {
      const invalidDates = [
        "13/01/2023", // invalid month
        "00/01/2023", // invalid month
        "01/32/2023", // invalid day
        "01/00/2023", // invalid day
        "02/30/2023", // invalid day for February
        "04/31/2023", // invalid day for April
        "1/01/2023", // missing leading zero in month
        "01/1/2023", // missing leading zero in day
        "2023-01-01", // wrong format
        "2023/01/01", // wrong separator
        "01-01-2023", // wrong separator
        "01/01/23", // short year
        // "01/01/2023T00:00:00Z", // includes time
        // "01/01/2023 00:00:00", // includes time
        "01/2023", // missing day
        "2023", // missing month and day
        "", // empty string
        "invalid-date",
      ];

      test.each(invalidDates)("should not match invalid US date: %s", date => {
        expect(US_DATE_REGEX.test(date)).toBe(false);
        expect(() => usDateSchema.parse(date)).toThrow();
      });
    });
  });

  describe("Schema validation", () => {
    describe("isoDateSchema", () => {
      it("should parse valid ISO date", () => {
        const result = isoDateSchema.parse("2023-12-25");
        expect(result).toBe("2023-12-25");
      });

      it("should throw error for invalid ISO date", () => {
        expect(() => isoDateSchema.parse("2023-13-01")).toThrow("date must be a valid ISO date");
      });
    });

    describe("usDateSchema", () => {
      it("should parse valid US date", () => {
        const result = usDateSchema.parse("12/25/2023");
        expect(result).toBe("12/25/2023");
      });

      it("should throw error for invalid US date", () => {
        expect(() => usDateSchema.parse("13/01/2023")).toThrow("date must be a valid US date");
      });
    });
  });
});
