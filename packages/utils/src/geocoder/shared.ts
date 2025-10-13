import csv from "csv-parser";
import fs from "fs";

export function readCsv(path: string): Promise<{ headers: string[]; rows: object[] }> {
  return new Promise((resolve, reject) => {
    const headers: string[] = [];
    const rows: object[] = [];
    fs.createReadStream(path)
      .pipe(
        csv({
          mapHeaders: ({ header }) => {
            headers.push(header);
            return header;
          },
        })
      )
      .on("data", data => rows.push(data))
      .on("end", () => resolve({ headers, rows }))
      .on("error", error => reject(error));
  });
}
