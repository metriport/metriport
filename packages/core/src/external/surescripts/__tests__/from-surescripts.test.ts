import {
  fromSurescriptsDate,
  fromSurescriptsUtcDate,
  fromSurescriptsTime,
  fromSurescriptsUUID,
  fromSurescriptsInteger,
  fromSurescriptsString,
  fromSurescriptsEnum,
} from "../schema/shared";

describe("Surescripts schema parsing", () => {
  it("should parse dates", () => {
    expect(fromSurescriptsDate()("20250101").getTime()).toEqual(new Date("2025-01-01").getTime());
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
    const date = converter("12345678");
    expect(date.getHours()).toEqual(12);
    expect(date.getMinutes()).toEqual(34);
    expect(date.getSeconds()).toEqual(56);
    expect(date.getMilliseconds()).toEqual(780);
  });

  it("should parse time without centiseconds", () => {
    const converter = fromSurescriptsTime({ centisecond: false });
    const date = converter("123456");
    expect(date.getHours()).toEqual(12);
    expect(date.getMinutes()).toEqual(34);
    expect(date.getSeconds()).toEqual(56);
    expect(date.getMilliseconds()).toEqual(0);
  });

  it("should parse time with centiseconds", () => {
    const converter = fromSurescriptsTime({ centisecond: true });
    const date = converter("12345699");
    expect(date.getHours()).toEqual(12);
    expect(date.getMinutes()).toEqual(34);
    expect(date.getSeconds()).toEqual(56);
    expect(date.getMilliseconds()).toEqual(990);
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
