import { getFileContents } from "@metriport/core/util/fs";
import fs from "fs";
import readline from "readline";

export function getIdsFromFile(fileName: string): string[] {
  const fileContents = getFileContents(fileName);
  const idsFromFile = fileContents
    .split(/\r?\n/)
    .map(id => id.replaceAll('"', "").replaceAll("'", "").trim())
    .filter(id => id.length > 0 && id.toLowerCase() !== "id");
  return idsFromFile;
}

/**
 * Streams a file line by line and returns an array of IDs, similar to getIdsFromFile,
 * but without loading the entire file into memory.
 */
export async function getIdsFromLargeFile(fileName: string): Promise<string[]> {
  const ids: string[] = [];
  const fileStream = fs.createReadStream(fileName, { encoding: "utf8" });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const id = line.replaceAll('"', "").replaceAll("'", "").trim();
    if (id.length > 0 && id.toLowerCase() !== "id") {
      ids.push(id);
    }
  }

  return ids;
}
