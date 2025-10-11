import fs from "fs";
import path from "path";
import {
  GREATER_THAN,
  LESS_THAN,
  cleanUpTranslationCode,
  replaceXmlTagChars,
  xmlTranslationCodeRegex,
  replaceAmpersand,
  removeXlinkHrefNamespace,
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

describe("replaceAmpersand", () => {
  test("should be backwards compatible", () => {
    // The previous regex only searched for /\s&\s/g, so it would only work for cases where
    // " & " should be replaced by " &amp; "
    expect(replaceAmpersand(createTestCase(" & "))).toBe(createTestCase(" &amp; "));
  });

  test("should replace unescaped ampersand with escaped ampersand", () => {
    expect(replaceAmpersand(createTestCase("a&b"))).toBe(createTestCase("a&amp;b"));
  });

  test("should not replace escaped hexadecimal sequence", () => {
    expect(replaceAmpersand(createTestCase("yo&#xA9;yo&ox3;"))).toBe(
      createTestCase("yo&#xA9;yo&amp;ox3;")
    );
  });

  test("should not replace escaped decimal sequence", () => {
    expect(replaceAmpersand(createTestCase("APPEARANCE:&#160;a&ox3.&#160;"))).toBe(
      createTestCase("APPEARANCE:&#160;a&amp;ox3.&#160;")
    );
  });

  test("should not replace the five predefined XML entities", () => {
    expect(replaceAmpersand(createTestCase("&lt;"))).toBe(createTestCase("&lt;"));
    expect(replaceAmpersand(createTestCase("&gt;"))).toBe(createTestCase("&gt;"));
    expect(replaceAmpersand(createTestCase("&amp;"))).toBe(createTestCase("&amp;"));
    expect(replaceAmpersand(createTestCase("&quot;"))).toBe(createTestCase("&quot;"));
    expect(replaceAmpersand(createTestCase("&apos;"))).toBe(createTestCase("&apos;"));
  });

  test("should not replace already escaped ampersand", () => {
    expect(replaceAmpersand(createTestCase("A &amp; B"))).toBe(createTestCase("A &amp; B"));
    expect(replaceAmpersand(createTestCase("A &amp;amp; B"))).toBe(createTestCase("A &amp;amp; B"));
  });

  test("should work in edge cases", () => {
    expect(replaceAmpersand(createTestCase("&"))).toBe(createTestCase("&amp;"));
    expect(replaceAmpersand(createTestCase("&&amp;"))).toBe(createTestCase("&amp;&amp;"));
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

describe("removeXlinkHrefNamespace", () => {
  test("should replace xlink:href with href", () => {
    const imageTag = `<image xlink:href="https://example.com">`;
    expect(removeXlinkHrefNamespace(createTestCase(imageTag))).toBe(
      createTestCase(imageTag.replace("xlink:href", "href"))
    );
  });

  test("should replace many instances of xlink:href", () => {
    const imageTag = `<image xlink:href="https://example.com"><br/><image xlink:href="https://example2.com">`;
    expect(removeXlinkHrefNamespace(createTestCase(imageTag))).toBe(
      createTestCase(imageTag.replace(/xlink:href/g, "href"))
    );
  });

  test("should keep original if no xlink:href", () => {
    const imageTag = `<image href="https://example.com">`;
    expect(removeXlinkHrefNamespace(createTestCase(imageTag))).toBe(createTestCase(imageTag));
  });
});

function createTestCase(str: string): string {
  return `<ClinicalDocument>${str}</ClinicalDocument>`;
}
