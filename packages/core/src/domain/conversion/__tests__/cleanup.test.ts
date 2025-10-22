import fs from "fs";
import path from "path";
import {
  GREATER_THAN,
  LESS_THAN,
  cleanUpTranslationCode,
  replaceXmlTagChars,
  xmlTranslationCodeRegex,
  replaceAmpersand,
  replaceNullFlavor,
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

  test("should not affect commented out XML processing instructions", () => {
    const input =
      '<!-- <?xml version="1.0" encoding="UTF-8" standalone="yes"?><?xml-stylesheet type="text/xsl" href="/admin/CDA.xsl>"?> -->';
    const expected =
      '<!-- <?xml version="1.0" encoding="UTF-8" standalone="yes"?><?xml-stylesheet type="text/xsl" href="/admin/CDA.xsl>"?> -->';
    expect(replaceXmlTagChars(input)).toBe(expected);
  });

  test("should not affect multiple commented sections", () => {
    const input = "<!-- <tag>content</tag> --><root>text</root><!-- <another>test</another> -->";
    const expected = "<!-- <tag>content</tag> --><root>text</root><!-- <another>test</another> -->";
    expect(replaceXmlTagChars(input)).toBe(expected);
  });

  test("should clean up < and > characters inside XML tags", () => {
    const input = '<tag attr="value < 5 and > 3">content</tag>';
    const expected = '<tag attr="value &lt; 5 and &gt; 3">content</tag>';
    expect(replaceXmlTagChars(input)).toBe(expected);
  });

  test("should clean up < and > characters in tag attributes", () => {
    const input = '<element condition="x < 10 and y > 5" />';
    const expected = '<element condition="x &lt; 10 and y &gt; 5" />';
    expect(replaceXmlTagChars(input)).toBe(expected);
  });

  test("should handle nested quotes in attributes", () => {
    const input = "<tag attr=\"outer 'inner < test >' end\">";
    const expected = "<tag attr=\"outer 'inner &lt; test &gt;' end\">";
    expect(replaceXmlTagChars(input)).toBe(expected);
  });
});

describe("replaceNullFlavor", () => {
  test('should replace <id nullFlavor="NI" with <id extension="1" root="1"', () => {
    const input = '<id nullFlavor="NI">';
    const expected = '<id extension="1" root="1">';
    expect(replaceNullFlavor(input)).toBe(expected);
  });

  test("should replace all nullFlavor values in id tags", () => {
    const input = '<id nullFlavor="UNK">';
    const expected = '<id extension="1" root="1">';
    expect(replaceNullFlavor(input)).toBe(expected);
  });

  test("should only replace nullFlavor in id tags, not other elements", () => {
    const input =
      '<id nullFlavor="NI"><assignedPerson><name><given nullFlavor="NA"/><family nullFlavor="NA"/>';
    const expected =
      '<id extension="1" root="1"><assignedPerson><name><given nullFlavor="NA"/><family nullFlavor="NA"/>';
    expect(replaceNullFlavor(input)).toBe(expected);
  });

  test("should handle multiple occurrences of id tags with nullFlavor", () => {
    const input = '<id nullFlavor="NI">text<id nullFlavor="UNK">more';
    const expected = '<id extension="1" root="1">text<id extension="1" root="1">more';
    expect(replaceNullFlavor(input)).toBe(expected);
  });

  test("should handle nullFlavor with different spacing", () => {
    const input = '<id nullFlavor = "NI">';
    const expected = '<id extension="1" root="1">';
    expect(replaceNullFlavor(input)).toBe(expected);
  });

  test("should handle nullFlavor id that still contains an extension", () => {
    const input = '<id nullFlavor="NI" extension"12345">';
    const expected = '<id extension="1" root="1">';
    expect(replaceNullFlavor(input)).toBe(expected);
  });

  test("should handle case sensitivity in nullFlavor values", () => {
    const input = '<id nullFlavor="ni">';
    const expected = '<id extension="1" root="1">';
    expect(replaceNullFlavor(input)).toBe(expected);
  });
});

function createTestCase(str: string): string {
  return `<ClinicalDocument>${str}</ClinicalDocument>`;
}
