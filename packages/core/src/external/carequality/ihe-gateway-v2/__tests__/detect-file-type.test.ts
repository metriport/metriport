import fs from "fs";
import path from "path";
import { detectFileType } from "../../../../util/file-type";

describe("detectFileType with all files in directory", () => {
  const filesDir = path.join(__dirname, "files");
  const files = fs.readdirSync(filesDir);

  files.forEach(file => {
    it(`should process and print the file type for ${file}`, () => {
      const filePath = path.join(filesDir, file);
      const fileContent = fs.readFileSync(filePath);
      const fileContentB64 = fileContent.toString("base64");
      const response = detectFileType(fileContentB64);
      console.log(`${file}: ${response}`);
    });
  });
});
