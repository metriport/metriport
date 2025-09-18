import csv from "csv-parser";
import fs from "fs";
import path from "path";

export function getCsvRunsPath(csvPath: string): string {
  return path.join(__dirname, "../../runs", csvPath);
}

export async function readCsv<T extends Record<string, unknown>>(csvPath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    fs.createReadStream(csvPath)
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
