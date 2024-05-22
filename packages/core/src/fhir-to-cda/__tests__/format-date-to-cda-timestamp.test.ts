import { formatDateToCdaTimestamp } from "../cda-templates/commons";
import dayjs from "dayjs";

describe("formatDateToCdaTimestamp", () => {
  it("should return undefined if dateString is undefined", () => {
    expect(formatDateToCdaTimestamp(undefined)).toBeUndefined();
  });

  it("should format date-time string with milliseconds correctly", () => {
    const dateTime = "2024-05-22T02:25:16.443Z";
    const formattedDateTime = formatDateToCdaTimestamp(dateTime);
    expect(formattedDateTime).toBe("20240522022516");
  });

  it("should format date-only string correctly", () => {
    const dateOnly = "1969-04-20";
    const formattedDateOnly = formatDateToCdaTimestamp(dateOnly);
    expect(formattedDateOnly).toBe("19690420");
  });

  it("should format date-time string without milliseconds correctly", () => {
    const dateTime = "2024-05-22T02:25:16Z";
    const formattedDateTime = formatDateToCdaTimestamp(dateTime);
    expect(formattedDateTime).toBe("20240522022516");
  });

  it('should format date-time string without "Z" correctly', () => {
    const dateTime = "2024-05-22T02:00:00.000";
    const formattedDateTime = formatDateToCdaTimestamp(dateTime);
    expect(formattedDateTime).toBe("20240522090000");
  });

  it("should format date-time string with timezone offset correctly", () => {
    const dateTime = "2024-05-22T02:25:16.443+02:00";
    const formattedDateTime = formatDateToCdaTimestamp(dateTime);
    expect(formattedDateTime).toBe("20240522002516");
  });

  it("should format invalid date string correctly", () => {
    const invalidDate = "invalid-date-string";
    const formattedDate = formatDateToCdaTimestamp(invalidDate);
    expect(formattedDate).toBe(dayjs(invalidDate).format("YYYYMMDDHHmmss"));
  });
});
