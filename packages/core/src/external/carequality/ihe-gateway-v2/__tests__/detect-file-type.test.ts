import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { detectFileType } from "../../../../util/file-type";
import { parseFileFromString } from "../xca/parse-file-from-string";

describe("detectFileType for all file types with non-xml body flow", () => {
  const testFiles = [
    { name: "test.pdf", mimeType: "application/pdf", extension: ".pdf" },
    { name: "test-little-endian.tiff", mimeType: "image/tiff", extension: ".tiff" },
    { name: "test-big-endian.tiff", mimeType: "image/tiff", extension: ".tiff" },
    { name: "test-with-declaration.xml", mimeType: "application/xml", extension: ".xml" },
    { name: "test-no-declaration.xml", mimeType: "application/xml", extension: ".xml" },
    { name: "test.txt", mimeType: "text/plain", extension: ".txt" },
    { name: "test.jpeg", mimeType: "image/jpeg", extension: ".jpeg" },
    { name: "test.png", mimeType: "image/png", extension: ".png" },
    { name: "test.bmp", mimeType: "image/bmp", extension: ".bmp" },
    { name: "test.webp", mimeType: "application/octet-stream", extension: ".bin" },
  ];

  const xmlTemplatePath = path.join(__dirname, "./xmls/dr-no-mime-type.xml");
  const xmlTemplate = fs.readFileSync(xmlTemplatePath, "utf8");
  const nonXmlBodyTemplatePath = path.join(__dirname, "./files/non-xml-body.xml");
  const nonXmlBodyTemplate = fs.readFileSync(nonXmlBodyTemplatePath, "utf8");

  testFiles.forEach(({ name, mimeType, extension }) => {
    describe(`${name}`, () => {
      const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));
      const fileContentB64 = fileContent.toString("base64");
      const modifiedNonXmlBody = nonXmlBodyTemplate.replace(
        '<text mediaType="" representation="B64" />',
        `<text mediaType="${mimeType}" representation="B64">${fileContentB64}</text>`
      );
      const modifiedNonXmlBodyB64 = Buffer.from(modifiedNonXmlBody).toString("base64");

      const modifiedXml = xmlTemplate.replace(
        "<Document></Document>",
        `<Document>${fileContentB64}</Document>`
      );

      it(`should correctly identify the ${extension} file from raw content`, () => {
        const response = detectFileType(fileContent);
        expect(response).toEqual({ mimeType, extension });
      });

      it(`should correctly identify the ${extension} file after converting to b64 and then decoding`, () => {
        const decodedFileContent = Buffer.from(fileContentB64, "base64");
        const response = detectFileType(decodedFileContent);
        expect(response).toEqual({ mimeType, extension });
      });

      it("should correctly extract and parse the embedded file from base64 encoded XML", () => {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "_",
          textNodeName: "_text",
          parseAttributeValue: false,
          removeNSPrefix: true,
        });
        const cda = parser.parse(modifiedXml);
        const document = cda.Envelope.Body.RetrieveDocumentSetResponse.DocumentResponse.Document;
        const parsedFile = parseFileFromString(document);
        expect(parsedFile.mimeType).toEqual(mimeType);
      });

      it(`should correctly extract and parse the embedded file from base64 encoded non-xml-body for ${extension}`, () => {
        const parsedFile = parseFileFromString(modifiedNonXmlBodyB64);
        expect(parsedFile.mimeType).toEqual(mimeType);
      });
    });
  });
});
