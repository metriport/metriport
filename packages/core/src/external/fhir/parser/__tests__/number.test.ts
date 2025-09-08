import { parseNumber } from "../number";

describe("number parsing", () => {
  it("should parse numbers", () => {
    const parsed = parseNumber("123");
    expect(parsed?.value).toEqual(123);
    expect(parsed?.remainder).toEqual("");
  });

  it("should parse numeric zero", () => {
    const parsed = parseNumber("0");
    expect(parsed?.value).toEqual(0);
    expect(parsed?.remainder).toEqual("");
  });

  it("should parse the word zero", () => {
    const parsed = parseNumber("zero");
    expect(parsed?.value).toEqual(0);
    expect(parsed?.remainder).toEqual("");
  });

  it("should parse numbers below twenty", () => {
    expect(parseNumber("zero")?.value).toEqual(0);
    expect(parseNumber("one")?.value).toEqual(1);
    expect(parseNumber("two")?.value).toEqual(2);
    expect(parseNumber("three")?.value).toEqual(3);
    expect(parseNumber("four")?.value).toEqual(4);
    expect(parseNumber("five")?.value).toEqual(5);
    expect(parseNumber("six")?.value).toEqual(6);
    expect(parseNumber("seven")?.value).toEqual(7);
    expect(parseNumber("eight")?.value).toEqual(8);
    expect(parseNumber("nine")?.value).toEqual(9);
    expect(parseNumber("ten")?.value).toEqual(10);
    expect(parseNumber("eleven")?.value).toEqual(11);
    expect(parseNumber("twelve")?.value).toEqual(12);
    expect(parseNumber("thirteen")?.value).toEqual(13);
    expect(parseNumber("fourteen")?.value).toEqual(14);
    expect(parseNumber("fifteen")?.value).toEqual(15);
    expect(parseNumber("sixteen")?.value).toEqual(16);
    expect(parseNumber("seventeen")?.value).toEqual(17);
    expect(parseNumber("eighteen")?.value).toEqual(18);
    expect(parseNumber("nineteen")?.value).toEqual(19);
    expect(parseNumber("twenty")?.value).toEqual(20);
  });

  it("should parse all possible two digit numbers", () => {
    const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    const tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    for (let i = 0; i < tens.length; i++) {
      const tenDisplay = tens[i];
      const tenValue = 10 * (i + 2);
      for (let j = 0; j < ones.length; j++) {
        const oneDisplay = j == 0 ? "" : ones[j];
        const oneValue = j;
        expect(parseNumber(`${tenDisplay} ${oneDisplay}`)?.value).toEqual(tenValue + oneValue);
      }
    }
  });

  it("should parse hyphenated numbers", () => {
    expect(parseNumber("twenty-one")).toEqual({ value: 21, remainder: "" });
    expect(parseNumber("forty-two is the answer")).toEqual({
      value: 42,
      remainder: " is the answer",
    });
    expect(parseNumber("ten thousand buddhas")).toEqual({ value: 10000, remainder: " buddhas" });
    expect(parseNumber("one hundred twenty three")).toEqual({ value: 123, remainder: "" });
    // expect(parseNumber("one hundred twenty three thousand four hundred fifty six")).toEqual({ value: 123456, remainder: "" });
  });

  it("should parse numbers and normalize whitespaces", () => {
    const parsed = parseNumber("1.342  ");
    expect(parsed?.value).toEqual(1.342);
    expect(parsed?.remainder).toEqual("");

    const parsed2 = parseNumber("  1.342 a  b c");
    expect(parsed2?.value).toEqual(1.342);
    expect(parsed2?.remainder).toEqual(" a  b c");
  });

  it("should parse numbers with accurate remainder", () => {
    const parsed = parseNumber("123 abc 789");
    expect(parsed?.value).toEqual(123);
    expect(parsed?.remainder).toEqual(" abc 789");
  });

  it("should parse numbers with words", () => {
    const parsed = parseNumber("one two three");
    expect(parsed?.value).toEqual(1);
    expect(parsed?.remainder).toEqual(" two three");
  });

  it("should parse tens when written as words", () => {
    const parsed = parseNumber("twenty three times");
    expect(parsed?.value).toEqual(23);
    expect(parsed?.remainder).toEqual(" times");
  });

  it("should parse hundreds when written as words", () => {
    const parsed = parseNumber("one hundred twenty three places");
    expect(parsed?.value).toEqual(123);
    expect(parsed?.remainder).toEqual(" places");
  });

  it("should parse thousands when written as words", () => {
    const parsed = parseNumber("one thousand twenty three locations");
    expect(parsed?.value).toEqual(1023);
    expect(parsed?.remainder).toEqual(" locations");
  });
});
