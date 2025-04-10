import { isValidISODate, validateDateIsAfter1900, validateIsPastOrPresentSafe, buildDayjs } from "../date";

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
});

describe("buildDayjs", () => {
  it("returns valid dayjs object for dates after 1900", () => {
    const date1 = buildDayjs("2000-01-01");
    const date2 = buildDayjs("1900-01-01");
    
    expect(date1.isValid()).toBe(true);
    expect(date2.isValid()).toBe(true);
    expect(date1.year()).toBe(2000);
    expect(date2.year()).toBe(1900);
  });
  
  it("returns invalid dayjs object for dates before 1900", () => {
    const date1 = buildDayjs("1899-12-31");
    const date2 = buildDayjs("1800-01-01");
    const date3 = buildDayjs("0800-01-01");
    
    expect(date1.isValid()).toBe(false);
    expect(date2.isValid()).toBe(false);
    expect(date3.isValid()).toBe(false);
  });
  
  it("handles edge cases correctly", () => {
    const currentDate = buildDayjs();
    const invalidDate = buildDayjs("not-a-date");
    const twoDigitYear = buildDayjs("99-01-01", "YY-MM-DD");

    expect(currentDate.isValid()).toBe(true);
    expect(invalidDate.isValid()).toBe(false);
    expect(twoDigitYear.isValid()).toBe(true);
  });
});
