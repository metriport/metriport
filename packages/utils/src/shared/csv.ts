import csv from "csv-parser";
import fs from "fs";
import path from "path";
import * as stream from "stream";

export function getCsvRunsPath(csvPath: string): string {
  if (path.isAbsolute(csvPath)) {
    return csvPath;
  }
  return path.join(__dirname, "../../runs", csvPath);
}

export function startOutputCsv(fullCsvPath: string, headers: readonly string[]): void {
  fs.writeFileSync(fullCsvPath, headers.map(h => `"${h}"`).join(",") + "\n");
}

export function appendToOutputCsv(fullCsvPath: string, row: string[]) {
  fs.appendFileSync(fullCsvPath, row.map(cell => `"${cell}"`).join(",") + "\n");
}

export async function readCsv<T>(csvPath: string): Promise<T[]> {
  const fullCsvPath = getCsvRunsPath(csvPath);
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    fs.createReadStream(fullCsvPath)
      .pipe(csv())
      .on("data", (row: T) => {
        rows.push(row);
      })
      .on("end", () => {
        resolve(rows);
      })
      .on("error", error => {
        reject(error);
      });
  });
}

export async function readCsvFromString<T>(csvString: string): Promise<T[]> {
  const s = new stream.Readable();
  s.push(csvString);
  s.push(null); // indicates end-of-file
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    s.pipe(csv())
      .on("data", async data => {
        rows.push(data);
      })
      .on("end", async () => {
        return resolve(rows);
      })
      .on("error", reject);
  });
}

export async function streamCsv<T>(
  csvPath: string,
  handler: (row: T) => void
): Promise<{ rowsProcessed: number; errorCount: number }> {
  return new Promise((resolve, reject) => {
    let rowsProcessed = 0;
    let errorCount = 0;
    const fullCsvPath = getCsvRunsPath(csvPath);
    fs.createReadStream(fullCsvPath)
      .pipe(csv())
      .on("data", (row: T) => {
        rowsProcessed++;
        try {
          handler(row);
        } catch (error) {
          errorCount++;
        }
      })
      .on("end", () => {
        resolve({ rowsProcessed, errorCount });
      })
      .on("error", reject);
  });
}
