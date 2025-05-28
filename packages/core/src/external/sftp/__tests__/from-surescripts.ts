import {
  fromSurescriptsDate,
  fromSurescriptsUtcDate,
  fromSurescriptsTime,
  fromSurescriptsUUID,
  fromSurescriptsInteger,
  fromSurescriptsString,
  fromSurescriptsEnum,
} from "../surescripts/schema/shared";

describe("Surescripts schema parsing", () => {
  it("should parse dates", () => {
    expect(fromSurescriptsDate()("20250101")).toEqual(new Date("2025-01-01"));
  });

  it("should parse optional dates", () => {
    expect(fromSurescriptsDate({ optional: true })("")).toEqual(undefined);
  });

  it("should throw an error for invalid dates", () => {
    const converter = fromSurescriptsDate();
    expect(() => converter("1234")).toThrow();
  });

  it("should throw an error for invalid optional dates", () => {
    const converter = fromSurescriptsDate({ optional: true });
    expect(() => converter("invalid")).toThrow();
  });

  it("should parse utc dates", () => {
    const converter = fromSurescriptsUtcDate();
    expect(converter("2025-01-01T12:34:56.00")).toEqual(new Date("2025-01-01T12:34:56.00"));
  });

  it("should parse time", () => {
    const converter = fromSurescriptsTime();
    expect(converter("12345678")).toEqual(new Date("12:34:56.78"));
    expect(converter("01010101")).toEqual(new Date("01:01:01.01"));
    expect(converter("23595999")).toEqual(new Date("23:59:59.99"));
  });

  it("should parse time without centiseconds", () => {
    const converter = fromSurescriptsTime({ centisecond: false });
    expect(converter("123456")).toEqual(new Date("12:34:56"));
    expect(converter("010101")).toEqual(new Date("01:01:01"));
    expect(converter("235959")).toEqual(new Date("23:59:59"));
  });

  it("should parse uuid", () => {
    expect(fromSurescriptsUUID("12345678123412341234123456789012")).toEqual(
      "12345678-1234-1234-1234-123456789012"
    );
  });

  it("should parse integer", () => {
    const converter = fromSurescriptsInteger();
    expect(converter("123456")).toEqual(123456);
    expect(converter("000000")).toEqual(0);
    expect(converter("999999")).toEqual(999999);
  });

  it("should parse optional integer", () => {
    const converter = fromSurescriptsInteger({ optional: true });
    expect(converter("")).toEqual(undefined);
    expect(converter("123456")).toEqual(123456);
  });

  it("should parse string", () => {
    const converter = fromSurescriptsString();
    expect(converter("abc123")).toEqual("abc123");
  });

  it("should parse optional string", () => {
    const converter = fromSurescriptsString({ optional: true });
    expect(converter("")).toEqual(undefined);
    expect(converter("abc123")).toEqual("abc123");
  });

  it("should parse enum", () => {
    const converter = fromSurescriptsEnum(["A", "B", "C"]);
    expect(converter("A")).toEqual("A");
    expect(converter("B")).toEqual("B");
    expect(converter("C")).toEqual("C");
    expect(() => converter("D")).toThrow();
  });

  it("should parse optional enum", () => {
    const converter = fromSurescriptsEnum(["A", "B", "C"], { optional: true });
    expect(converter("")).toEqual(undefined);
    expect(converter("A")).toEqual("A");
  });
});
