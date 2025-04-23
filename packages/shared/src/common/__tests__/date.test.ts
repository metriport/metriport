import {
  buildDayjsFromCompactDate,
  isValidISODate,
  validateDateIsAfter1900,
  validateIsPastOrPresentSafe,
} from "../date";

describe("shared date functions", () => {
  describe("isValidISODate", () => {
    it("returns true for dates from E2E tests", async () => {
      expect(isValidISODate("2024-12-18T03:50:00.006Z")).toEqual(true);
      expect(isValidISODate("2024-12-18T04:18:01.263Z")).toEqual(true);
    });

    it("returns false for non-ISO format dates", () => {
      expect(isValidISODate("12/25/2023")).toBe(false);
      expect(isValidISODate("25-12-2023")).toBe(false);
      expect(isValidISODate("2023.12.25")).toBe(false);
      expect(isValidISODate("Dec 25, 2023")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidISODate("")).toBe(false);
    });

    it("returns false for invalid dates", () => {
      expect(isValidISODate("2023-13-01")).toBe(false);
      expect(isValidISODate("2023-12-32")).toBe(false);
      expect(isValidISODate("not-a-date")).toBe(false);
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
  });
});

describe("validateDateIsAfter1900", () => {
  it("returns true for dates after 1900", () => {
    expect(validateDateIsAfter1900("1999-12-31")).toBe(true);
    expect(validateDateIsAfter1900("1970-01-31")).toBe(true);
  });

  it("returns false for dates before 1900", () => {
    expect(validateDateIsAfter1900("1899-12-31")).toBe(false);
    expect(validateDateIsAfter1900("970-01-31")).toBe(false);
  });

  it("returns true for 1900-01-01", () => {
    expect(validateDateIsAfter1900("1900-01-01")).toBe(true);
  });

  it("returns false for dates with years less than 1000", () => {
    expect(validateDateIsAfter1900("0007-01-01")).toBe(false);
    expect(validateDateIsAfter1900("0014-01-01")).toBe(false);
  });
});

describe("buildDayjsFromCompactDate", () => {
  it("parses compact date format correctly", () => {
    const compactDate = "20240226123000+0000";
    const result = buildDayjsFromCompactDate(compactDate);
    expect(result.format()).toBe("2024-02-26T12:30:00Z");
  });

  it("correctly handless offset", () => {
    const compactDate = "20240226123000+0130";
    const result = buildDayjsFromCompactDate(compactDate);
    expect(result.format()).toBe("2024-02-26T11:00:00Z");
  });

  it("handles regular date format", () => {
    const regularDate = "2024-02-26T12:30:00Z";
    const result = buildDayjsFromCompactDate(regularDate);
    expect(result.format()).toBe("2024-02-26T12:30:00Z");
  });

  it("handles short date format", () => {
    const regularDate = "2024-02-26";
    const result = buildDayjsFromCompactDate(regularDate);
    expect(result.format()).toBe("2024-02-26T00:00:00Z");
  });

  it("falls back to regular date parsing for invalid compact date format", () => {
    const invalidDate = "20240226123000";
    const result = buildDayjsFromCompactDate(invalidDate);
    expect(result.format()).toBe("2024-02-26T12:30:00Z");
  });
});