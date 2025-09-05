import { parseNumber } from "../number";

describe("number parsing", () => {
  it("should parse numbers", () => {
    const { value, remainder } = parseNumber("123");
    expect(value).toEqual(123);
    expect(remainder).toEqual("");
  });

  it("should parse numeric zero", () => {
    const { value, remainder } = parseNumber("0");
    expect(value).toEqual(0);
    expect(remainder).toEqual("");
  });

  it("should parse the word zero", () => {
    const { value, remainder } = parseNumber("zero");
    expect(value).toEqual(0);
    expect(remainder).toEqual("");
  });

  it("should parse numbers below twenty", () => {
    expect(parseNumber("zero").value).toEqual(0);
    expect(parseNumber("one").value).toEqual(1);
    expect(parseNumber("two").value).toEqual(2);
    expect(parseNumber("three").value).toEqual(3);
    expect(parseNumber("four").value).toEqual(4);
    expect(parseNumber("five").value).toEqual(5);
    expect(parseNumber("six").value).toEqual(6);
    expect(parseNumber("seven").value).toEqual(7);
    expect(parseNumber("eight").value).toEqual(8);
    expect(parseNumber("nine").value).toEqual(9);
    expect(parseNumber("ten").value).toEqual(10);
    expect(parseNumber("eleven").value).toEqual(11);
    expect(parseNumber("twelve").value).toEqual(12);
    expect(parseNumber("thirteen").value).toEqual(13);
    expect(parseNumber("fourteen").value).toEqual(14);
    expect(parseNumber("fifteen").value).toEqual(15);
    expect(parseNumber("sixteen").value).toEqual(16);
    expect(parseNumber("seventeen").value).toEqual(17);
    expect(parseNumber("eighteen").value).toEqual(18);
    expect(parseNumber("nineteen").value).toEqual(19);
    expect(parseNumber("twenty").value).toEqual(20);
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
        expect(parseNumber(`${tenDisplay} ${oneDisplay}`).value).toEqual(tenValue + oneValue);
      }
    }
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
