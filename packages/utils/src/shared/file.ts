import fs from "fs";
import path from "path";

export function initFile(fileName: string, header?: string) {
  const dirName = path.dirname(fileName);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  if (header) {
    fs.writeFileSync(fileName, header);
  }
}
