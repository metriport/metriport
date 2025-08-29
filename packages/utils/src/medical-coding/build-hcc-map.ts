import { Command } from "commander";
import { readHccSource, writeHccMap, HccSourceRow } from "./shared";

/**
 * Builds a mapping of ICD-10 codes to HCCs by reading from the HCC source file.
 */
const command = new Command();
command.name("build-hcc-map");
command.option("--year <year>", "The year of HCC source to use (default 2025)");

const hccFunctionCode = `
export interface HccCode {
  v24: number[];
  v28: number[];
  display: string;
  icd10Code: string;
}

export function getHccForIcd10Code(icd10Code: string): HccCode | undefined {
  const hccRow = hccMap[icd10Code];
  if (!hccRow) {
    return undefined;
  }
  return {
    icd10Code,
    display: hccRow[0],
    v24: hccRow[1],
    v28: hccRow[2],
  }
}\n\n`;

command.action(async ({ year = "2025" }) => {
  const hccMap = await readHccSource(year);

  const grouped = groupRowsByCode(hccMap);

  const generated: string[] = [hccFunctionCode];

  // Generate the mapping of ICD-10 codes to HCCs
  generated.push(`export const hccMap: Record<string, [string, number[], number[]]> = {\n`);
  for (const [code, rows] of Object.entries(grouped)) {
    const hccV24 = getAllValidCodes(rows, "hcc_v24");
    const hccV28 = getAllValidCodes(rows, "hcc_v28");
    const description = getFirstValidValue(rows, "description");
    generated.push(
      `\t"${code}": ["${description}", [${hccV24.join(",")}], [${hccV28.join(",")}]],\n`
    );
  }
  generated.push(`};\n`);

  // Write the output to the TypeScript source file
  const output = generated.join("");
  writeHccMap("core/src/external/fhir/shared/hcc-map.ts", output);
});

function getAllValidCodes(rows: HccSourceRow[], key: keyof HccSourceRow): string[] {
  return rows.map(row => row[key]).filter(isValidNumber);
}

function getFirstValidValue(rows: HccSourceRow[], key: keyof HccSourceRow): string | undefined {
  const firstValid = rows.find(row => row[key] != null && row[key].trim() !== "");
  return firstValid ? firstValid[key] : undefined;
}

function isValidNumber(value: string): boolean {
  return Number.isFinite(parseInt(value));
}

function groupRowsByCode(rows: HccSourceRow[]): Record<string, HccSourceRow[]> {
  const grouped: Record<string, HccSourceRow[]> = {};
  for (const row of rows) {
    grouped[row.code] = grouped[row.code] || [];
    grouped[row.code].push(row);
  }
  return grouped;
}

export default command;
