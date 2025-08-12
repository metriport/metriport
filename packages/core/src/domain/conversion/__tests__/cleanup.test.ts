import fs from "fs";
import path from "path";
import {
  GREATER_THAN,
  LESS_THAN,
  cleanUpTranslationCode,
  replaceXmlTagChars,
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

describe("replaceXmlTagChars", () => {
  test("should replace '<' with spaces around it", () => {
    expect(replaceXmlTagChars(createTestCase("A < B"))).toBe(createTestCase(`A ${LESS_THAN} B`));
  });

  test("should replace '<' before a digit", () => {
    expect(replaceXmlTagChars(createTestCase("A < 5"))).toBe(createTestCase(`A ${LESS_THAN} 5`));
  });

  test("should replace '<' without a space before it", () => {
    expect(replaceXmlTagChars(createTestCase("A<5"))).toBe(createTestCase(`A${LESS_THAN}5`));
  });

  test("should replace '<' with a space after it", () => {
    expect(replaceXmlTagChars(createTestCase("A< 5"))).toBe(createTestCase(`A${LESS_THAN} 5`));
  });

  test("should not change text with no '<'", () => {
    expect(replaceXmlTagChars(createTestCase("No changes needed"))).toBe(
      createTestCase("No changes needed")
    );
  });

  test("should not replace '<' if it's part of an HTML tag", () => {
    expect(replaceXmlTagChars(createTestCase("<div>"))).toBe(createTestCase("<div>"));
  });

  test("should replace '>' with spaces around it", () => {
    expect(replaceXmlTagChars(createTestCase("A > B"))).toBe(createTestCase(`A ${GREATER_THAN} B`));
  });

  test("should replace '>' before a digit", () => {
    expect(replaceXmlTagChars(createTestCase("A > 5"))).toBe(createTestCase(`A ${GREATER_THAN} 5`));
  });

  test("should replace '>' without a space before it", () => {
    expect(replaceXmlTagChars(createTestCase("A>5"))).toBe(createTestCase(`A${GREATER_THAN}5`));
  });

  test("should replace '>' with a space after it", () => {
    expect(replaceXmlTagChars(createTestCase("A> 5"))).toBe(createTestCase(`A${GREATER_THAN} 5`));
  });

  test("should not change text with no '>'", () => {
    expect(replaceXmlTagChars(createTestCase("No changes needed here"))).toBe(
      createTestCase("No changes needed here")
    );
  });

  test("should not replace '>' if it's part of an HTML tag", () => {
    expect(replaceXmlTagChars(createTestCase("<div>"))).toBe(createTestCase("<div>"));
  });

  test("expectedly does not handle both '<' and '>' in the same text", () => {
    expect(replaceXmlTagChars(createTestCase("A < B > C"))).toBe(createTestCase(`A < B > C`));
  });
});

function createTestCase(str: string): string {
  return `<ClinicalDocument>${str}</ClinicalDocument>`;
}
