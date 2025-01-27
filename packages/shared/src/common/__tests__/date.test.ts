import { isValidISODate, validateIsPastOrPresentSafe } from "../date";

describe("shared date functions", () => {
  describe("isValidISODate", () => {
    it("returns true for dates from E2E tests", async () => {
      expect(isValidISODate("2024-12-18T03:50:00.006Z")).toEqual(true);
      expect(isValidISODate("2024-12-18T04:18:01.263Z")).toEqual(true);
    });
  });

  describe("validateIsPastOrPresentSafe", () => {
    it("returns true for past dates", () => {
      expect(validateIsPastOrPresentSafe("2020-01-01")).toBe(true);
      expect(validateIsPastOrPresentSafe("1950-12-31")).toBe(true);
    });

    it("returns true for present date", () => {
      const today = new Date().toISOString();
      expect(validateIsPastOrPresentSafe(today)).toBe(true);
    });

    it("returns false for future dates", () => {
      const futureDate = "2525-01-01";
      expect(validateIsPastOrPresentSafe(futureDate)).toBe(false);
    });

    it("returns false for dates before 1900", () => {
      expect(validateIsPastOrPresentSafe("1899-12-31")).toBe(false);
      expect(validateIsPastOrPresentSafe("970-01-31")).toBe(false);
    });
  });
});
