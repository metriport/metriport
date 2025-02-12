import fs from "fs";
import path from "path";
import { cleanUpTranslationCode, xmlTranslationCodeRegex } from "../cleanup";

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
