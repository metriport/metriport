import { formatDateToHumanReadableFormat } from "../cda-templates/commons";
import dayjs from "dayjs";

describe("formatDateToHumanReadableFormat", () => {
  it("should return undefined if dateString is undefined", () => {
    expect(formatDateToHumanReadableFormat(undefined)).toBeUndefined();
  });

  it("should format date-time string with milliseconds correctly", () => {
    const dateTime = "2024-05-22T02:25:16.443Z";
    const formattedDateTime = formatDateToHumanReadableFormat(dateTime);
    expect(formattedDateTime).toBe("05/22/2024 2:25 AM");
  });

  it("should format date-only string correctly", () => {
    const dateOnly = "1969-04-20";
    const formattedDateOnly = formatDateToHumanReadableFormat(dateOnly);
    expect(formattedDateOnly).toBe("04/20/1969");
  });

  it("should format date-time string without milliseconds correctly", () => {
    const dateTime = "2024-05-22T02:25:16Z";
    const formattedDateTime = formatDateToHumanReadableFormat(dateTime);
    expect(formattedDateTime).toBe("05/22/2024 2:25 AM");
  });

  it('should format date-time string without "Z" correctly', () => {
    const dateTime = "2024-05-22T02:00:00.000";
    const formattedDateTime = formatDateToHumanReadableFormat(dateTime);
    expect(formattedDateTime).toBe("05/22/2024 9:00 AM");
  });

  it("should format date-time string with timezone offset correctly", () => {
    const dateTime = "2024-05-22T02:25:16.443+02:00";
    const formattedDateTime = formatDateToHumanReadableFormat(dateTime);
    expect(formattedDateTime).toBe("05/22/2024 12:25 AM");
  });

  it("should format invalid date string correctly", () => {
    const invalidDate = "invalid-date-string";
    const formattedDate = formatDateToHumanReadableFormat(invalidDate);
    expect(formattedDate).toBe(dayjs(invalidDate).format("YYYYMMDDHHmmss"));
  });
});
