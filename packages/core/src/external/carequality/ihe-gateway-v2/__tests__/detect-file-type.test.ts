import fs from "fs";
import path from "path";
import { detectFileType } from "../../../../util/file-type";

describe("detectFileType for all file types", () => {
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

  testFiles.forEach(({ name, mimeType, extension }) => {
    describe(`${name}`, () => {
      const fileContent = fs.readFileSync(path.join(__dirname, `./files/${name}`));

      it(`should correctly identify the ${extension} file from raw content`, () => {
        const response = detectFileType(fileContent);
        expect(response).toEqual({ mimeType, extension });
      });

      it(`should correctly identify the ${extension} file after converting to b64 and then decoding`, () => {
        const fileContentB64 = fileContent.toString("base64");
        const decodedFileContent = Buffer.from(fileContentB64, "base64");
        const response = detectFileType(decodedFileContent);
        expect(response).toEqual({ mimeType, extension });
      });
    });
  });
});
