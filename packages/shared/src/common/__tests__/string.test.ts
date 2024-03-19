import { faker } from "@faker-js/faker";
import { limitStringLength } from "../string";

describe("limitStringLength", () => {
  it("returns undefined when it gets undefined", async () => {
    const resp = limitStringLength(undefined);
    expect(resp).toBeUndefined();
  });

  it("returns empty when it gets empty", async () => {
    const expected = "";
    const resp = limitStringLength(expected);
    expect(resp).toEqual(expected);
  });

  it("returns input when it gets one char string", async () => {
    const expected = faker.string.alphanumeric(1);
    const resp = limitStringLength(expected);
    expect(resp).toEqual(expected);
  });

  it("returns input when it gets multiple char string", async () => {
    const stringLength = faker.number.int({ min: 2, max: 254 });
    const expected = faker.string.alphanumeric(stringLength);
    const resp = limitStringLength(expected);
    expect(resp).toEqual(expected);
  });

  it("returns input when it gets max char string", async () => {
    const expected = faker.string.alphanumeric(255);
    const resp = limitStringLength(expected);
    expect(resp).toEqual(expected);
  });

  it("does not cap string if length < suffix", async () => {
    const expected = faker.string.alphanumeric(2);
    const resp = limitStringLength(expected, 1);
    expect(resp).toEqual(expected);
  });

  it("caps string if length > max", async () => {
    const expected = "123456";
    const resp = limitStringLength(expected, 5);
    expect(resp).not.toContain(expected);
    expect(resp).toContain("12");
  });

  it("defaults max chars to 255", async () => {
    const input = faker.string.alphanumeric(256);
    const expected = input.substring(0, 252) + "...";
    const resp = limitStringLength(input);
    expect(resp).toEqual(expected);
  });

  it("defaults suffix to three dots", async () => {
    const expected = "123456";
    const resp = limitStringLength(expected, 5);
    expect(resp).not.toContain(expected);
    expect(resp).toContain("12...");
  });

  it("uses custom suffix when provided", async () => {
    const expected = "123456";
    const customSuffix = "!!!";
    const resp = limitStringLength(expected, 5, customSuffix);
    expect(resp).not.toContain(expected);
    expect(resp).toContain("12" + customSuffix);
  });
});
