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

export interface UcumSourceRow {
  code: string;
  name: string;
  definition: string;
  created: string;
  synonym: string;
  kind: string;
  revised: string;
  concept_id: string;
  dimension: string;
}

export async function readHccSource(year: string): Promise<HccSourceRow[]> {
  const hccSourcePath = path.resolve(process.cwd(), "runs/hcc", `${year}.csv`);
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

export async function readUcumSource(): Promise<UcumSourceRow[]> {
  const ucumSourcePath = path.resolve(process.cwd(), "runs/ucum", `data.tsv`);
  return new Promise((resolve, reject) => {
    const rows: UcumSourceRow[] = [];
    fs.createReadStream(ucumSourcePath)
      .pipe(csv({ separator: "\t" }))
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

export function writeToPackage(packageName: "core", destination: string, generated: string): void {
  const destinationPath = path.resolve(
    path.join(process.cwd(), ".."),
    packageName,
    "src",
    destination
  );
  const destinationDir = path.dirname(destinationPath);
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }
  fs.writeFileSync(destinationPath, generated, "utf-8");
}
