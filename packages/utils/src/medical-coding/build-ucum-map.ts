import { Command } from "commander";
import { readUcumSource, writeToPackage } from "./shared";

/**
 * Builds a mapping of UCUM codes to UCUM names by reading from the UCUM source file.
 */
const command = new Command();
command.name("build-ucum-map");

// The TypeScript code that is prepended to the generated file output.
const ucumFunctionCode = `
import { UNIT_OF_MEASURE_URL } from "@metriport/shared/medical";
import { Quantity } from "@medplum/fhirtypes";
import { getFirstToken } from "./shared";

export function createUcumQuantity(value: number, code: string): Quantity {
  return {
    value,
    unit: code,
    system: UNIT_OF_MEASURE_URL,
    code,
  };
}

export function parseUcumUnit(inputString: string): { code?: string; remainder: string } | undefined {
  const [ unit, remainder ] = getFirstToken(inputString);
  const validCode = getValidUcumCode(unit);
  if (!validCode) return undefined;
  return { code: validCode, remainder };
}

export function getValidUcumCode(inputString: string): string | undefined {
  const unit = inputString.trim();
  const validCode = unitToValidUcumCode[unit];
  return validCode;
}\n\n`;

command.action(async () => {
  const ucumRows = await readUcumSource();
  const generated: string[] = [ucumFunctionCode];

  // Generate the mapping of ICD-10 codes to HCCs
  generated.push(`export const unitToValidUcumCode: Record<string, string> = {\n`);
  const includedCodes = new Set<string>();
  for (const row of ucumRows) {
    if (includedCodes.has(row.code)) continue;
    includedCodes.add(row.code);
    generated.push(`\t"${row.code}": "${row.code}",\n`);

    for (const synonym of row.synonym.split(",")) {
      if (includedCodes.has(synonym)) continue;
      includedCodes.add(synonym);
      generated.push(`\t"${synonym.trim()}": "${row.code}",\n`);
    }
  }
  generated.push(`};\n`);

  // Write the output to the TypeScript source file
  const output = generated.join("");
  writeToPackage("core", "external/fhir/parser/ucum-unit.ts", output);
});

export default command;
