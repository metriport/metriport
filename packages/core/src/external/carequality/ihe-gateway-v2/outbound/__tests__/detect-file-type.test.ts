import fs from "fs";
import path from "path";
import { detectFileType } from "../../../../../util/file-type";
import { parseFileFromString } from "../xca/process/parse-file-from-string";
import { testFiles } from "./constants";

describe("detectFileType for all file types with non-xml body flow", () => {
  const nonXmlBodyTemplatePath = path.join(__dirname, "./files/non-xml-body.xml");
  const nonXmlBodyTemplate = fs.readFileSync(nonXmlBodyTemplatePath, "utf8");

  testFiles.forEach(({ name, mimeType, fileExtension }) => {
    describe(`${name}`, () => {
      const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));
      const fileContentB64 = fileContent.toString("base64");
      const modifiedNonXmlBody = nonXmlBodyTemplate.replace(
        '<text mediaType="" representation="B64" />',
        `<text mediaType="${mimeType}" representation="B64">${fileContentB64}</text>`
      );
      const modifiedNonXmlBodyB64 = Buffer.from(modifiedNonXmlBody).toString("base64");

      it(`should correctly identify the ${fileExtension} file from raw content`, () => {
        const response = detectFileType(fileContent);
        expect(response).toEqual({ mimeType, fileExtension });
      });

      it(`should correctly identify the ${fileExtension} file after converting to b64 and then decoding`, () => {
        const decodedFileContent = Buffer.from(fileContentB64, "base64");
        const response = detectFileType(decodedFileContent);
        expect(response).toEqual({ mimeType, fileExtension });
      });

      it(`should correctly extract and parse the embedded file from base64 encoded non-xml-body for ${fileExtension}`, () => {
        const parsedFile = parseFileFromString(modifiedNonXmlBodyB64);
        expect(parsedFile.mimeType).toEqual(mimeType);
      });
    });
  });
});
