import { getFileContents } from "@metriport/core/util/fs";

export function getIdsFromFile(fileName: string): string[] {
  const fileContents = getFileContents(fileName);
  const idsFromFile = fileContents
    .split(/\r?\n/)
    .map(id => id.replaceAll('"', "").replaceAll("'", "").trim())
    .filter(id => id.length > 0 && id.toLowerCase() !== "id");
  return idsFromFile;
}
