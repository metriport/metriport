import { Command } from "commander";
import { CcsrSourceRow, readCcsrSource, writeToPackage } from "./shared";

/**
 * This script builds a mapping of ICD-10-CM codes to CCSR categories by reading from the CCSR source file.
 *
 * Run it using this command:
 *   npm run medical-coding build-ccsr-map -- --file <full-path-to>/DXCCSR_v2025-1.csv
 */

const EXCLUDED_CCSR_CODES = ["XXX000", "XXX111"];

const command = new Command();
command.name("build-ccsr-map");
command.option("--file <file>", "The CCSR CSV file name (default: ccsr.csv)");

// The TypeScript code that is prepended to the generated file output.
const ccsrFunctionCode = `
export function getCcsrCategoryDescription(category: string): string | undefined {
  return ccsrCategoryToDescription[category];
}

export function getCcsrCodeDescription(code: string): string | undefined {
  return ccsrCodeToDescription[code];
}

export function getCcsrCodesForIcd10Code(icd10CmCode: string): string[] {
  const icd10CodeNormalizedForLookup = icd10CmCode.replace(".", "").trim().toUpperCase();
  return icd10ToCcsrCodes[icd10CodeNormalizedForLookup] ?? [];
}\n\n`;

function extractCcsrCodesAndDescriptions(
  row: CcsrSourceRow
): Array<{ code: string; description: string }> {
  // Collect all code/description pairs, including defaults
  const codeDescs = [
    {
      code: normalizeValue(row.defaultccsrcategoryip),
      description: normalizeValue(row.defaultccsrcategorydescriptionip),
    },
    {
      code: normalizeValue(row.defaultccsrcategoryop),
      description: normalizeValue(row.defaultccsrcategorydescriptionop),
    },
    {
      code: normalizeValue(row.ccsrcategory1),
      description: normalizeValue(row.ccsrcategory1description),
    },
    {
      code: normalizeValue(row.ccsrcategory2),
      description: normalizeValue(row.ccsrcategory2description),
    },
    {
      code: normalizeValue(row.ccsrcategory3),
      description: normalizeValue(row.ccsrcategory3description),
    },
    {
      code: normalizeValue(row.ccsrcategory4),
      description: normalizeValue(row.ccsrcategory4description),
    },
    {
      code: normalizeValue(row.ccsrcategory5),
      description: normalizeValue(row.ccsrcategory5description),
    },
    {
      code: normalizeValue(row.ccsrcategory6),
      description: normalizeValue(row.ccsrcategory6description),
    },
  ];

  // Deduplicate by code, keeping the first occurrence
  const seenCodes = new Set<string>();
  const codesWithDescriptions: Array<{ code: string; description: string }> = [];

  for (const { code, description } of codeDescs) {
    if (code && description && !seenCodes.has(code)) {
      seenCodes.add(code);
      codesWithDescriptions.push({ code, description });
    }
  }

  return codesWithDescriptions;
}

function normalizeValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let normalizedValue = value;

  if (value.startsWith("'") && value.endsWith("'")) {
    normalizedValue = normalizedValue.slice(1, -1);
  }
  const trimmedValue = normalizedValue.trim();
  if (trimmedValue === "") return undefined;
  return trimmedValue;
}

interface ProcessedData {
  icd10ToCcsrCodes: Record<string, string[]>;
  ccsrCodeToDescription: Record<string, string>;
}

function processRows(rows: CcsrSourceRow[]): ProcessedData {
  const icd10ToCcsrCodes: Record<string, Set<string>> = {};
  const ccsrCodeToDescription: Record<string, string> = {};

  for (const row of rows) {
    const icd10Code = normalizeValue(row.icd10cmcode);
    if (!icd10Code) continue;

    // Extract all CCSR codes and their descriptions
    const codesWithDescriptions = extractCcsrCodesAndDescriptions(row);

    // Initialize set for this ICD-10 code if not exists
    if (!icd10ToCcsrCodes[icd10Code]) {
      icd10ToCcsrCodes[icd10Code] = new Set<string>();
    }

    // Add CCSR codes and descriptions (excluding administrative codes)
    for (const { code, description } of codesWithDescriptions) {
      if (EXCLUDED_CCSR_CODES.includes(code)) {
        continue;
      }
      icd10ToCcsrCodes[icd10Code].add(code);
      // Store description for CCSR code (only if not already set)
      if (!ccsrCodeToDescription[code]) {
        ccsrCodeToDescription[code] = description;
      }
    }
  }

  // Convert Sets to arrays
  const icd10ToCcsrCodesArray: Record<string, string[]> = {};
  for (const [icd10Code, ccsrCodesSet] of Object.entries(icd10ToCcsrCodes)) {
    icd10ToCcsrCodesArray[icd10Code] = Array.from(ccsrCodesSet);
  }

  return {
    icd10ToCcsrCodes: icd10ToCcsrCodesArray,
    ccsrCodeToDescription,
  };
}

command.action(async ({ file = "ccsr.csv" }) => {
  const ccsrRows = await readCcsrSource(file);
  const processed = processRows(ccsrRows);
  const generated: string[] = [ccsrFunctionCode];

  // Generate CCSR category to description map
  generated.push(`export const ccsrCategoryToDescription: Record<string, string> = {\n`);
  for (const [category, description] of Object.entries(ccsrCategories)) {
    const escapedDescription = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    generated.push(`\t"${category}": "${escapedDescription}",\n`);
  }
  generated.push(`};\n\n`);

  // Generate CCSR code to description map
  generated.push(`export const ccsrCodeToDescription: Record<string, string> = {\n`);
  for (const [code, description] of Object.entries(processed.ccsrCodeToDescription)) {
    const escapedDescription = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    generated.push(`\t"${code}": "${escapedDescription}",\n`);
  }
  generated.push(`};\n\n`);

  // Generate ICD-10-CM code to CCSR codes map (1:M)
  generated.push(`export const icd10ToCcsrCodes: Record<string, string[]> = {\n`);
  for (const [icd10Code, ccsrCodes] of Object.entries(processed.icd10ToCcsrCodes)) {
    const ccsrCodesArray = ccsrCodes
      .map(code => `"${code.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
      .join(", ");
    generated.push(`\t"${icd10Code}": [${ccsrCodesArray}],\n`);
  }
  generated.push(`};\n`);

  // Write the output to the TypeScript source file
  const output = generated.join("");
  writeToPackage("core", "external/fhir/shared/ccsr-map.ts", output);
});

const ccsrCategories: Record<string, string> = {
  BLD: "Diseases of the blood and blood-forming organs and certain disorders involving the immune mechanism",
  CIR: "Diseases of the circulatory system",
  DEN: "Dental diseases",
  DIG: "Diseases of the digestive system",
  EAR: "Diseases of the ear and mastoid process",
  END: "Endocrine, nutritional, and metabolic diseases",
  EXT: "External causes of morbidity",
  EYE: "Diseases of the eye and adnexa",
  FAC: "Factors influencing health status and contact with health services",
  GEN: "Diseases of the genitourinary system",
  INF: "Certain infectious and parasitic diseases",
  INJ: "Injury, poisoning and certain other consequences of external causes",
  MAL: "Congenital malformations, deformations and chromosomal abnormalities",
  MBD: "Mental, behavioral, and neurodevelopmental disorders",
  MUS: "Diseases of the musculoskeletal system and connective tissue",
  NEO: "Neoplasms",
  NVS: "Diseases of the nervous system",
  PNL: "Certain conditions originating in the perinatal period",
  PRG: "Pregnancy, childbirth, and the puerperium",
  RSP: "Diseases of the respiratory system",
  SKN: "Diseases of the skin and subcutaneous tissue",
  SYM: "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified",
};

export default command;
