import { BadRequestError } from "@metriport/shared";
import { parseISODate } from "../date";

describe("parseISODate", () => {
  it("returns undefined when date is missing", () => {
    expect(parseISODate(undefined)).toBeUndefined();
  });

  it("returns ISO dates unchanged", () => {
    expect(parseISODate("2024-06-01")).toEqual("2024-06-01");
  });

  it("coerces ISO dateTime to YYYY-MM-DD", () => {
    expect(parseISODate("2024-06-01T11:14:17.452Z")).toEqual("2024-06-01");
  });

  it("throws BadRequestError for invalid dates", () => {
    expect(() => parseISODate("not-a-date")).toThrow(BadRequestError);
    expect(() => parseISODate("06/01/2024")).toThrow(BadRequestError);
    expect(() => parseISODate("")).toThrow(BadRequestError);
  });
});
