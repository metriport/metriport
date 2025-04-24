import {
  buildDayjsFromCompactDate,
  isValidISODate,
  validateDateIsAfter1900,
  validateIsPastOrPresentSafe,
} from "../date";

describe("shared date functions", () => {
  describe("isValidISODate", () => {
    it("returns true for valid ISO datetime with milliseconds", () => {
      expect(isValidISODate("2024-12-18T03:50:00.006Z")).toBe(true);
    });

    it("returns true for valid ISO datetime with different milliseconds", () => {
      expect(isValidISODate("2024-12-18T04:18:01.263Z")).toBe(true);
    });

    it("returns true for valid ISO datetime near end of day", () => {
      expect(isValidISODate("2024-12-18T23:59:59.999Z")).toBe(true);
    });

    it("returns false for ISO date strings without time component", () => {
      expect(isValidISODate("2024-12-18")).toBe(false);
    });

    it("returns false for ISO datetime missing Z timezone marker", () => {
      expect(isValidISODate("2024-12-18T03:50:00.006")).toBe(false);
    });

    it("returns false for ISO datetime with space instead of T", () => {
      expect(isValidISODate("2024-12-18 03:50:00.006Z")).toBe(false);
    });

    it("returns false for ISO datetime with incorrect millisecond format", () => {
      expect(isValidISODate("2024-12-18T03:50:00.0006Z")).toBe(false);
    });

    it("returns false for date in MM/DD/YYYY format", () => {
      expect(isValidISODate("12/25/2023")).toBe(false);
    });

    it("returns false for date in DD-MM-YYYY format", () => {
      expect(isValidISODate("25-12-2023")).toBe(false);
    });

    it("returns false for date in YYYY.MM.DD format", () => {
      expect(isValidISODate("2023.12.25")).toBe(false);
    });

    it("returns false for date in month name format", () => {
      expect(isValidISODate("Dec 25, 2023")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidISODate("")).toBe(false);
    });

    it("returns false for date with invalid month", () => {
      expect(isValidISODate("2023-13-01T00:00:00.000Z")).toBe(false);
    });

    it("returns false for date with invalid day", () => {
      expect(isValidISODate("2023-12-32T00:00:00.000Z")).toBe(false);
    });

    it("returns false for date with invalid minute", () => {
      expect(isValidISODate("2023-12-01T00:60:00.000Z")).toBe(false);
    });

    it("returns false for non-date string", () => {
      expect(isValidISODate("not-a-date")).toBe(false);
    });
  });

  describe("validateIsPastOrPresentSafe", () => {
    it("returns true for date in 2020", () => {
      expect(validateIsPastOrPresentSafe("2020-01-01")).toBe(true);
    });

    it("returns true for date in 1950", () => {
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
  });

  it("returns true for dates in 1970", () => {
    expect(validateDateIsAfter1900("1970-01-31")).toBe(true);
  });

  it("returns true for 1900-01-01", () => {
    expect(validateDateIsAfter1900("1900-01-01")).toBe(true);
  });

  it("returns false for dates before 1900", () => {
    expect(validateDateIsAfter1900("1899-12-31")).toBe(false);
  });

  it("returns false for dates with years less than 1000", () => {
    expect(validateDateIsAfter1900("0007-01-01")).toBe(false);
  });

  it("returns false for dates with years less than 1000 (2)", () => {
    expect(validateDateIsAfter1900("0014-01-01")).toBe(false);
  });

  it("returns false for dates with years less than 1000 (3)", () => {
    expect(validateDateIsAfter1900("0123-01-01")).toBe(false);
  });

  it("returns false for dates with year 970", () => {
    expect(validateDateIsAfter1900("970-01-31")).toBe(false);
  });
});

describe("buildDayjsFromCompactDate", () => {
  it("parses compact date format correctly", () => {
    const compactDate = "20240226123000+0000";
    const result = buildDayjsFromCompactDate(compactDate);
    expect(result.format()).toBe("2024-02-26T12:30:00Z");
  });

  it("correctly handles offset", () => {
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
