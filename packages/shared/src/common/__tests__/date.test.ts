import {
  buildDayjsFromCompactDate,
  isValidISODate,
  validateDateIsAfter1900,
  validateIsPastOrPresentSafe,
  convertDateToString,
  convertDateToTimeString,
} from "../date";

describe("shared date functions", () => {
  describe("isValidISODate", () => {
    it("returns true for dates from E2E tests", async () => {
      expect(isValidISODate("2024-12-18T03:50:00.006Z")).toEqual(true);
      expect(isValidISODate("2024-12-18T04:18:01.263Z")).toEqual(true);
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

  it("handles MM/DD/YYYY format incorrectly returning false for valid years", () => {
    expect(validateDateIsAfter1900("12/31/2020")).toBe(false);
  });

  it("handles DD/MM/YYYY format incorrectly returning false for valid years", () => {
    expect(validateDateIsAfter1900("31/12/2020")).toBe(false);
  });

  it("handles YYYY.MM.DD format returning true for valid years", () => {
    expect(validateDateIsAfter1900("2020.12.31")).toBe(true);
  });

  it("handles YYYY/MM/DD format returning true for valid years", () => {
    expect(validateDateIsAfter1900("2020/12/31")).toBe(true);
  });

  it("handles textual month format incorrectly", () => {
    expect(validateDateIsAfter1900("Dec 31, 2020")).toBe(false);
  });

  it("handles empty string format incorrectly", () => {
    expect(validateDateIsAfter1900("")).toBe(false);
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

describe("convertDateToString", () => {
  it("converts date to YYYYMMDD format", () => {
    const date = new Date("2024-02-26");
    expect(convertDateToString(date)).toBe("20240226");
  });

  it("converts date to YYYY-MM-DD format", () => {
    const date = new Date("2024-02-26");
    expect(convertDateToString(date, { separator: "-" })).toBe("2024-02-26");
  });

  it("converts date to YYYYMMDD format with separator", () => {
    const date = new Date("2024-02-26");
    expect(convertDateToString(date, { separator: "-" })).toBe("2024-02-26");
  });
});

describe("convertDateToTimeString", () => {
  it("converts date to HHMMSS format", () => {
    const date = new Date(Date.UTC(2024, 1, 26, 12, 30, 0));
    expect(convertDateToTimeString(date, { useUtc: true })).toBe("123000");
  });

  it("converts date to HHMMSSCC format", () => {
    const date = new Date(Date.UTC(2024, 1, 26, 12, 30, 0, 123));
    expect(convertDateToTimeString(date, { useUtc: true, includeCentisecond: true })).toBe(
      "12300012"
    );
  });
});
