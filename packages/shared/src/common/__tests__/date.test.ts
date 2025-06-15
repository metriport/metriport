import {
  buildDayjsFromCompactDate,
  convertDateToString,
  convertDateToTimeString,
  isValidISODate,
  validateDateIsAfter1900,
  validateDateOfBirth,
  ValidateDobFn,
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

  describe("validateDateOfBirth", () => {
    let validateDateIsAfter1900_mock: jest.Mock;
    let validateIsPastOrPresent_mock: jest.Mock;

    beforeEach(() => {
      validateDateIsAfter1900_mock = jest.fn((date: string) => true); // eslint-disable-line @typescript-eslint/no-unused-vars
      validateIsPastOrPresent_mock = jest.fn((date: string) => true); // eslint-disable-line @typescript-eslint/no-unused-vars
    });

    afterEach(() => {
      validateDateIsAfter1900_mock.mockReset();
      validateIsPastOrPresent_mock.mockReset();
    });

    function validateDob(theDate: string): boolean {
      return validateDateOfBirth(theDate, {
        validateDateIsAfter1900: validateDateIsAfter1900_mock as unknown as ValidateDobFn,
        validateIsPastOrPresent: validateIsPastOrPresent_mock as unknown as ValidateDobFn,
      });
    }

    it("returns false for empty string", () => {
      expect(validateDateOfBirth("")).toBe(false);
      expect(validateDateIsAfter1900_mock).not.toHaveBeenCalled();
      expect(validateIsPastOrPresent_mock).not.toHaveBeenCalled();
    });

    it("returns false for invalid date", () => {
      expect(validateDateOfBirth("invalid-date")).toBe(false);
      expect(validateDateIsAfter1900_mock).not.toHaveBeenCalled();
      expect(validateIsPastOrPresent_mock).not.toHaveBeenCalled();
    });

    it("returns false for date with less than 10 characters with full year and month", () => {
      expect(validateDateOfBirth("2001-02-0")).toBe(false);
      expect(validateDateIsAfter1900_mock).not.toHaveBeenCalled();
      expect(validateIsPastOrPresent_mock).not.toHaveBeenCalled();
    });

    it("returns false for date with less than 10 characters with full year and day", () => {
      expect(validateDateOfBirth("2001-9-01")).toBe(false);
      expect(validateDateIsAfter1900_mock).not.toHaveBeenCalled();
      expect(validateIsPastOrPresent_mock).not.toHaveBeenCalled();
    });

    it("returns false for date with less than 10 characters with full month and day", () => {
      expect(validateDateOfBirth("01-02-01")).toBe(false);
      expect(validateDateIsAfter1900_mock).not.toHaveBeenCalled();
      expect(validateIsPastOrPresent_mock).not.toHaveBeenCalled();
    });

    it("returns true when both validateDateIsAfter1900 and validateIsPastOrPresent return true", () => {
      validateDateIsAfter1900_mock.mockReturnValue(true);
      validateIsPastOrPresent_mock.mockReturnValue(true);
      expect(validateDob("1850-01-01")).toBe(true);
    });

    it("returns false when validateDateIsAfter1900 is false", () => {
      validateDateIsAfter1900_mock.mockReturnValue(false);
      validateIsPastOrPresent_mock.mockReturnValue(true);
      expect(validateDob("1850-01-01")).toBe(false);
    });

    it("returns false when validateIsPastOrPresent is false", () => {
      validateDateIsAfter1900_mock.mockReturnValue(true);
      validateIsPastOrPresent_mock.mockReturnValue(false);
      expect(validateDob("1850-01-01")).toBe(false);
    });

    it("returns false when date is incorrectly passed as number", () => {
      expect(validateDob(2000 as unknown as string)).toBe(false);
      expect(validateDateIsAfter1900_mock).not.toHaveBeenCalled();
      expect(validateIsPastOrPresent_mock).not.toHaveBeenCalled();
    });

    it("returns true when date is valid ISO datetime", () => {
      expect(validateDob("2004-02-26T12:30:00Z")).toBe(true);
    });

    it("returns true when date is valid ISO datetime", () => {
      expect(validateDob("2004-02-26")).toBe(true);
    });

    it("returns false when date is invalid ISO date", () => {
      expect(validateDob("85-02-26")).toBe(false);
    });

    it("returns true when date is valid US datetime", () => {
      expect(validateDob("02/26/2004")).toBe(true);
    });

    it("returns false when date is invalid US date", () => {
      expect(validateDob("02/26/85")).toBe(false);
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
