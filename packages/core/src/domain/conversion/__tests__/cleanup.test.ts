import fs from "fs";
import path from "path";
import {
  LESS_THAN,
  cleanUpTranslationCode,
  replaceLessThanChar,
  xmlTranslationCodeRegex,
} from "../cleanup";

describe("cleanUpTranslationCode", () => {
  it("regex correctly gets the translation code", () => {
    const xmlFilePath = path.join(__dirname, "example.xml");
    const xmlContent = fs.readFileSync(xmlFilePath, "utf-8");
    const matches = xmlContent.match(xmlTranslationCodeRegex);
    const match = matches?.[0];

    expect(match).toBeDefined();
    expect(match).toEqual(`<translation code="272.4\\272.4"`);
  });

  it("correctly replaces the junk code with something legible", () => {
    const xmlFilePath = path.join(__dirname, "example.xml");
    const xmlContent = fs.readFileSync(xmlFilePath, "utf-8");
    const result = cleanUpTranslationCode(xmlContent);
    const matches = result.match(xmlTranslationCodeRegex);
    const translationCodeMatch = matches?.[0];

    expect(result).not.toContain(`<translation code="272.4\\272.4"`);
    expect(translationCodeMatch).toBeDefined();
    expect(translationCodeMatch).toEqual(`<translation code="272.4"`);
  });
});

describe("replaceLessThanChar", () => {
  test("should replace '<' with spaces around it", () => {
    expect(replaceLessThanChar("A < B")).toBe(`A ${LESS_THAN} B`);
  });

  test("should replace '<' before a digit", () => {
    expect(replaceLessThanChar("A < 5")).toBe(`A ${LESS_THAN} 5`);
  });

  test("should replace '<' without a space before it", () => {
    expect(replaceLessThanChar("A<5")).toBe(`A ${LESS_THAN} 5`);
  });

  test("should replace '<' with a space after it", () => {
    expect(replaceLessThanChar("A< 5")).toBe(`A ${LESS_THAN} 5`);
  });

  test("should not replace '<' before a letter", () => {
    expect(replaceLessThanChar("A<B")).toBe("A<B");
  });

  test("should not change text with no '<'", () => {
    expect(replaceLessThanChar("No changes needed")).toBe("No changes needed");
  });

  test("should not replace '<' if it's part of an HTML tag", () => {
    expect(replaceLessThanChar("<div>")).toBe("<div>");
  });
});
