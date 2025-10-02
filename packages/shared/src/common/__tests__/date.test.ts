import {
  buildDayjsFromCompactDate,
  convertDateToString,
  convertDateToTimeString,
  isValidateDayAndMonthStringBased,
  isValidISODate,
  isValidISODateTime,
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

  describe("isValidISODateTime", () => {
    it("returns true for dates from E2E tests", async () => {
      expect(isValidISODateTime("2024-12-18T03:50:00.006Z")).toEqual(true);
      expect(isValidISODateTime("2024-12-18T04:18:01.263Z")).toEqual(true);
    });

    it("returns false for invalid date", () => {
      expect(isValidISODateTime("invalid-date")).toEqual(false);
    });

    it("returns false for invalid date - missing T", () => {
      expect(isValidISODateTime("2024-12-1804:18:01.263Z")).toEqual(false);
    });

    it("returns true if only date is provided", () => {
      expect(isValidISODateTime("2024-12-18")).toEqual(true);
    });

    it("returns true for partial match", () => {
      expect(isValidISODateTime("2024-12-18T04:18:01.263")).toEqual(true);
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

    it("returns true for valid date time in ISO format", () => {
      expect(validateDateIsAfter1900("1970-01-31T12:30:00Z")).toBe(true);
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

    it("returns false for dates with 3 digit year", () => {
      expect(validateDateIsAfter1900("970-01-31")).toBe(false);
    });

    it("returns false for dates with 2 digit year", () => {
      expect(validateDateIsAfter1900("70-01-31")).toBe(false);
    });

    it("returns false for dates in MM/DD/YYYY format", () => {
      expect(validateDateIsAfter1900("12/31/2020")).toBe(false);
    });

    it("returns false for dates in DD/MM/YYYY format", () => {
      expect(validateDateIsAfter1900("31/12/2020")).toBe(false);
    });

    it("returns true for dates in YYYY.MM.DD format", () => {
      expect(validateDateIsAfter1900("2020.12.31")).toBe(true);
    });

    it("returns true for dates in YYYY/MM/DD format", () => {
      expect(validateDateIsAfter1900("2020/12/31")).toBe(true);
    });

    it("returns false for dates in text format", () => {
      expect(validateDateIsAfter1900("Dec 31, 2020")).toBe(false);
    });

    it("returns false for empty string", () => {
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

describe("isValidateDayAndMonthStringBased", () => {
  describe("valid date formats", () => {
    it("should return true for valid ISO date strings", () => {
      expect(isValidateDayAndMonthStringBased("2023-01-01")).toBe(true);
      expect(isValidateDayAndMonthStringBased("2023-12-31")).toBe(true);
      expect(isValidateDayAndMonthStringBased("2000-06-15")).toBe(true);
    });

    it("should return true for leap year dates", () => {
      expect(isValidateDayAndMonthStringBased("2020-02-29")).toBe(true);
      expect(isValidateDayAndMonthStringBased("2000-02-29")).toBe(true);
      expect(isValidateDayAndMonthStringBased("2024-02-29")).toBe(true);
    });

    it("should return true for months with 30 days", () => {
      expect(isValidateDayAndMonthStringBased("2023-04-30")).toBe(true); // April
      expect(isValidateDayAndMonthStringBased("2023-06-30")).toBe(true); // June
      expect(isValidateDayAndMonthStringBased("2023-09-30")).toBe(true); // September
      expect(isValidateDayAndMonthStringBased("2023-11-30")).toBe(true); // November
    });

    it("should return true for months with 31 days", () => {
      expect(isValidateDayAndMonthStringBased("2023-01-31")).toBe(true); // January
      expect(isValidateDayAndMonthStringBased("2023-03-31")).toBe(true); // March
      expect(isValidateDayAndMonthStringBased("2023-05-31")).toBe(true); // May
      expect(isValidateDayAndMonthStringBased("2023-07-31")).toBe(true); // July
      expect(isValidateDayAndMonthStringBased("2023-08-31")).toBe(true); // August
      expect(isValidateDayAndMonthStringBased("2023-10-31")).toBe(true); // October
      expect(isValidateDayAndMonthStringBased("2023-12-31")).toBe(true); // December
    });
  });

  describe("invalid date formats", () => {
    it("should return false for non-ISO date format strings", () => {
      expect(isValidateDayAndMonthStringBased("01/01/2023")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023/01/01")).toBe(false);
      expect(isValidateDayAndMonthStringBased("01-01-2023")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-1-1")).toBe(false);
      expect(isValidateDayAndMonthStringBased("23-01-01")).toBe(false);
    });

    it("should return false for empty or invalid strings", () => {
      expect(isValidateDayAndMonthStringBased("")).toBe(false);
      expect(isValidateDayAndMonthStringBased("invalid")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-13-01")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-00-01")).toBe(false);
    });

    it("should return false for dates with invalid months", () => {
      expect(isValidateDayAndMonthStringBased("2023-13-01")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-00-01")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-14-01")).toBe(false);
    });

    it("should return false for dates with invalid days", () => {
      expect(isValidateDayAndMonthStringBased("2023-01-32")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-01-00")).toBe(false);
      expect(isValidateDayAndMonthStringBased("2023-01-99")).toBe(false);
    });
  });

  describe("month-specific day limits", () => {
    it("should return false for February 29 in non-leap years", () => {
      expect(isValidateDayAndMonthStringBased("2023-02-29")).toBe(false); // 2023 is not a leap year
      expect(isValidateDayAndMonthStringBased("2021-02-29")).toBe(false); // 2021 is not a leap year
      expect(isValidateDayAndMonthStringBased("2022-02-29")).toBe(false); // 2022 is not a leap year
    });

    it("should return false for February 30 in leap years", () => {
      expect(isValidateDayAndMonthStringBased("2020-02-30")).toBe(false); // 2020 is a leap year
      expect(isValidateDayAndMonthStringBased("2000-02-30")).toBe(false); // 2000 is a leap year
      expect(isValidateDayAndMonthStringBased("2024-02-30")).toBe(false); // 2024 is a leap year
    });

    it("should return false for months with 30 days when day is 31", () => {
      expect(isValidateDayAndMonthStringBased("2023-04-31")).toBe(false); // April has 30 days
      expect(isValidateDayAndMonthStringBased("2023-06-31")).toBe(false); // June has 30 days
      expect(isValidateDayAndMonthStringBased("2023-09-31")).toBe(false); // September has 30 days
      expect(isValidateDayAndMonthStringBased("2023-11-31")).toBe(false); // November has 30 days
    });

    it("should return false for months with 31 days when day is 32", () => {
      expect(isValidateDayAndMonthStringBased("2023-01-32")).toBe(false); // January has 31 days
      expect(isValidateDayAndMonthStringBased("2023-07-32")).toBe(false); // July has 31 days
      expect(isValidateDayAndMonthStringBased("2023-10-32")).toBe(false); // October has 31 days
      expect(isValidateDayAndMonthStringBased("2023-12-32")).toBe(false); // December has 31 days
    });
  });
});
