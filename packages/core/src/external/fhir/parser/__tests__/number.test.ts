import { parseNumber } from "../number";

describe("number parsing", () => {
  it("should parse numbers", () => {
    const { value, remainder } = parseNumber("123");
    expect(value).toEqual(123);
    expect(remainder).toEqual("");
  });

  it("should parse numbers and normalize whitespaces", () => {
    const { value, remainder } = parseNumber("1.342  ");
    expect(value).toEqual(1.342);
    expect(remainder).toEqual("");

    const { value: value2, remainder: remainder2 } = parseNumber("  1.342 a  b c");
    expect(value2).toEqual(1.342);
    expect(remainder2).toEqual("a  b c");
  });

  it("should parse numbers with accurate remainder", () => {
    const { value, remainder } = parseNumber("123 abc 789");
    expect(value).toEqual(123);
    expect(remainder).toEqual("abc 789");
  });

  it("should parse numbers with words", () => {
    const { value, remainder } = parseNumber("one two three");
    expect(value).toEqual(1);
    expect(remainder).toEqual("two three");
  });

  it("should parse tens when written as words", () => {
    const { value, remainder } = parseNumber("twenty three times");
    expect(value).toEqual(23);
    expect(remainder).toEqual("times");
  });

  it("should parse hundreds when written as words", () => {
    const { value, remainder } = parseNumber("one hundred twenty three places");
    expect(value).toEqual(123);
    expect(remainder).toEqual("places");
  });

  it("should parse thousands when written as words", () => {
    const { value, remainder } = parseNumber("one thousand twenty three locations");
    expect(value).toEqual(1023);
    expect(remainder).toEqual("locations");
  });
});
