import path from "path";
import fs from "fs";
import csv from "csv-parser";

export interface HccSourceRow {
  code: string;
  description: string;
  hcc_esrd_v21: string;
  hcc_esrd_v24: string;
  hcc_v22: string;
  hcc_v24: string;
  hcc_v28: string;
  rxhcc_v05: string;
  rxhcc_v08: string;
  hcc_esrd_v21_2024: string;
  hcc_esrd_v24_2024: string;
  hcc_v22_2024: string;
  hcc_v24_2024: string;
  hcc_v28_2024: string;
  rxhcc_v05_2024: string;
  rxhcc_v08_2024: string;
}

export async function readHccSource(year: string): Promise<HccSourceRow[]> {
  const hccSourcePath = path.resolve(process.cwd(), "hcc-source", `${year}.csv`);
  return new Promise((resolve, reject) => {
    const rows: HccSourceRow[] = [];
    fs.createReadStream(hccSourcePath)
      .pipe(csv())
      .on("data", function (row) {
        rows.push(row);
      })
      .on("end", function () {
        resolve(rows);
      })
      .on("error", function (error) {
        reject(error);
      });
  });
}
