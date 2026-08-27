import { getFileContents } from "@metriport/core/util/fs";
import * as fs from "fs";

export type PatientRecord = {
  cxId: string;
  patientId: string;
};

export function getIdsFromFile(fileName: string): string[] {
  const fileContents = getFileContents(fileName);
  const idsFromFile = fileContents
    .split(/\r?\n/)
    .map(id => id.replaceAll('"', "").replaceAll("'", "").trim())
    .filter(id => id.length > 0 && id.toLowerCase() !== "id");
  return idsFromFile;
}

/**
 * TODO: update this to use csv-parser
 *
 * Reads cx and patient IDs from a CSV file. It expects the file to have a header row and at
 * least one data row.
 * @param filePath - The path to the CSV file.
 * @returns An array of PatientRecord objects.
 */
export function readPatientIdsFromCsvFile(filePath: string): PatientRecord[] {
  const fileContents = fs.readFileSync(filePath, "utf-8");
  const lines = fileContents.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file must have at least a header row and one data row");
  }

  // Skip header row and parse data
  const dataLines = lines.slice(1);
  const records: PatientRecord[] = [];

  for (const line of dataLines) {
    const [cxId, patientId] = line.split(",").map(field => field.trim().replace(/['"]/g, ""));
    if (cxId && patientId) {
      records.push({ cxId, patientId });
    }
  }

  return records;
}
