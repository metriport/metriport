import {
  buildDayjsFromCompactDate,
  isValidISODate,
  validateIsAfter1900Safe,
  validateIsPastOrPresentSafe,
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

describe("validateIsAfter1900Safe", () => {
  it("returns true for dates after 1900", () => {
    expect(validateIsAfter1900Safe("1999-12-31")).toBe(true);
  });

  it("returns true for dates in 1970", () => {
    expect(validateIsAfter1900Safe("1970-01-31")).toBe(true);
  });

  it("returns true for 1900-01-01", () => {
    expect(validateIsAfter1900Safe("1900-01-01")).toBe(true);
  });

  it("returns false for dates before 1900", () => {
    expect(validateIsAfter1900Safe("1899-12-31")).toBe(false);
  });

  it("returns false for dates with years less than 1000 (3)", () => {
    expect(validateIsAfter1900Safe("0123-01-01")).toBe(false);
  });

  it("handles MM/DD/YYYY format correctly", () => {
    expect(validateIsAfter1900Safe("12/31/2020")).toBe(true);
  });

  it("handles YYYY.MM.DD format correctly", () => {
    expect(validateIsAfter1900Safe("2020.12.31")).toBe(true);
  });

  it("handles YYYY/MM/DD format correctly", () => {
    expect(validateIsAfter1900Safe("2020/12/31")).toBe(true);
  });

  it("handles textual month format correctly", () => {
    expect(validateIsAfter1900Safe("Dec 31, 2020")).toBe(true);
  });

  it("handles empty string format incorrectly", () => {
    expect(validateIsAfter1900Safe("")).toBe(false);
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
