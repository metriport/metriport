import { normalizeZipCode } from "../normalize-zip";

describe("normalizeZipCode", () => {
  test("should handle short zip codes", () => {
    const input = "1234";
    const expectedOutput = "1234";
    expect(normalizeZipCode(input)).toBe(expectedOutput);
  });

  test("should return first 4 characters when zip code length is 9", () => {
    const input = "1234-6677";
    const expectedOutput = "1234";
    expect(normalizeZipCode(input)).toBe(expectedOutput);
  });

  test("should return first 5 characters when zip code length is 10", () => {
    const input = "12345-6677";
    const expectedOutput = "12345";
    expect(normalizeZipCode(input)).toBe(expectedOutput);
  });

  test("should return first 5 characters when zip code length is 5", () => {
    const input = "54321";
    const expectedOutput = "54321";
    expect(normalizeZipCode(input)).toBe(expectedOutput);
  });

  test("should throw an error if zip contains non-digit and non-dash characters (length 9)", () => {
    const input = "12345-667a";
    expect(() => normalizeZipCode(input)).toThrow();
  });

  test("should throw an error if zip contains non-digit and non-dash characters (length 5)", () => {
    const input = "1234a";
    expect(() => normalizeZipCode(input)).toThrow();
  });

  test("should throw an error if zip is an empty string", () => {
    const input = "";
    expect(() => normalizeZipCode(input)).toThrow();
  });
});
