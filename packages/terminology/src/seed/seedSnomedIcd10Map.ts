import { ConceptMap } from "@medplum/fhirtypes";
import { createReadStream } from "node:fs";
import { argv } from "node:process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { TerminologyClient } from "../client";
import { lookupDisplay } from "./shared";

type SnomedIcd10MapRow = {
  id: string;
  effectiveTime: string;
  active: string;
  moduleId: string;
  refsetId: string;
  referencedComponentId: string;
  mapGroup: string;
  mapPriority: string;
  mapRule: string;
  mapAdvice: string;
  mapTarget: string;
  correlationId: string;
  mapCategoryId: string;
};

type SnomedToIcdMapping = {
  snomedCode: string;
  icd10Code: string;
  mapGroup: string;
  mapPriority: string;
  mapRule: string;
  mapAdvice: string;
  active: string;
  effectiveTime: string;
};

const TARGET_REFSET_ID = "6011000124106"; // ICD-10-CM complex map reference set
const SNOMED_SYSTEM = "http://snomed.info/sct";
const ICD10CM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm";

/**
 * Maps SNOMED CT to ICD-10-CM mapping rules to FHIR equivalence values
 */
function mapRuleToEquivalence(
  mapRule: string,
  mapAdvice: string
): "equivalent" | "wider" | "narrower" | "inexact" | "unmatched" | "disjoint" {
  // If the advice says "ALWAYS", it's likely an equivalent mapping
  if (mapAdvice.startsWith("ALWAYS")) {
    return "equivalent";
  }

  // If it's a simple TRUE rule, it's likely equivalent
  if (mapRule === "TRUE") {
    return "equivalent";
  }

  // If it's an OTHERWISE rule, it's a fallback (wider)
  if (mapRule.startsWith("OTHERWISE")) {
    return "wider";
  }

  // If it has complex conditions, it's more specific (narrower)
  if (mapRule.includes("IF") || mapRule.includes("IFA")) {
    return "narrower";
  }

  // Default to inexact for complex mappings
  return "inexact";
}

/**
 * Determines if a mapping should be included based on quality criteria
 */
function shouldIncludeMapping(mapping: SnomedToIcdMapping): boolean {
  // Only include active mappings
  if (mapping.active !== "1") {
    return false;
  }

  // Skip mappings with empty or invalid codes
  if (
    !mapping.snomedCode ||
    !mapping.icd10Code ||
    mapping.snomedCode.trim() === "" ||
    mapping.icd10Code.trim() === ""
  ) {
    return false;
  }

  return true;
}

async function createConceptMapFromSnomedMapping(
  mapping: SnomedToIcdMapping,
  sourceDisplay: string | undefined,
  targetDisplay: string | undefined
): Promise<ConceptMap> {
  return {
    resourceType: "ConceptMap",
    status: "active",
    group: [
      {
        source: SNOMED_SYSTEM,
        target: ICD10CM_SYSTEM,
        element: [
          {
            code: mapping.snomedCode,
            display: sourceDisplay,
            target: [
              {
                code: mapping.icd10Code,
                display: targetDisplay,
                equivalence: mapRuleToEquivalence(mapping.mapRule, mapping.mapAdvice),
                comment: mapping.mapAdvice, // Include the mapping advice as a comment
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Cleans the mapTarget by removing trailing '?' characters
 */
function cleanMapTarget(mapTarget: string): string {
  return mapTarget.endsWith("?") ? mapTarget.slice(0, -1) : mapTarget;
}

/**
 * Selects the best mapping from a list of mappings using the heuristic:
 * 1. If mapRule is "TRUE", use that one
 * 2. If "OTHERWISE TRUE" has a mapTarget, use that one
 * 3. Check if all IFA codes are the same, use that code
 * 4. If IFA codes are different, pick the one with priority 1
 * 5. Fallback: return the first mapping with a valid code
 */
function selectBestMapping(mappings: SnomedToIcdMapping[]): SnomedToIcdMapping | undefined {
  if (mappings.length === 0) return undefined;
  if (mappings.length === 1) return mappings[0];

  // 1. Look for mapRule = "TRUE" (unconditional mapping)
  const trueMapping = mappings.find(m => m.mapRule === "TRUE");
  if (trueMapping) {
    return trueMapping;
  }

  // 2. Look for "OTHERWISE TRUE" with a mapTarget
  const otherwiseTrueMapping = mappings.find(
    m => m.mapRule === "OTHERWISE TRUE" && m.icd10Code && m.icd10Code.trim() !== ""
  );
  if (otherwiseTrueMapping) {
    return otherwiseTrueMapping;
  }

  // 3. Check if all IFA codes are the same (with different displays)
  const ifaMappings = mappings.filter(
    m => m.mapRule.startsWith("IFA") && m.icd10Code && m.icd10Code.trim() !== ""
  );

  if (ifaMappings.length > 0) {
    // Check if all IFA statements use the same code
    const firstCode = ifaMappings[0].icd10Code;
    const allSameCode = ifaMappings.every(m => m.icd10Code === firstCode);

    if (allSameCode) {
      // Return the first IFA mapping since they're all the same
      return ifaMappings[0];
    }

    // 4. If IFA codes are different, pick the one with priority 1
    const priority1Mapping = ifaMappings.find(m => m.mapPriority === "1");
    if (priority1Mapping) {
      return priority1Mapping;
    }
  }

  // 5. Fallback: return the first mapping with a valid code
  const validMapping = mappings.find(m => m.icd10Code && m.icd10Code.trim() !== "");
  return validMapping || mappings[0];
}

async function processSnomedIcd10Map(inStream: Readable): Promise<void> {
  console.log("Creating readline interface...");
  const rl = createInterface(inStream);

  console.log("Creating TerminologyClient...");
  const client = new TerminologyClient();

  // First pass: collect all mappings and group them
  console.log("Collecting and grouping mappings...");
  const allMappings: SnomedToIcdMapping[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  let activeMappings = 0;
  let inactiveMappings = 0;
  let otherRefsetMappings = 0;
  let qualityFiltered = 0;

  for await (const line of rl) {
    if (line.trim() === "") continue; // Skip empty lines

    const rowObject = getRowAsObject(line);
    processedCount++;

    // Only process rows for the ICD-10-CM complex map
    if (rowObject.refsetId !== TARGET_REFSET_ID) {
      otherRefsetMappings++;
      skippedCount++;
      continue;
    }

    // Track active/inactive
    if (rowObject.active !== "1") {
      inactiveMappings++;
      skippedCount++;
      continue;
    } else {
      activeMappings++;
    }

    const mapping: SnomedToIcdMapping = {
      snomedCode: rowObject.referencedComponentId,
      icd10Code: cleanMapTarget(rowObject.mapTarget),
      mapGroup: rowObject.mapGroup,
      mapPriority: rowObject.mapPriority,
      mapRule: rowObject.mapRule,
      mapAdvice: rowObject.mapAdvice,
      active: rowObject.active,
      effectiveTime: rowObject.effectiveTime,
    };

    // Apply quality filters
    if (!shouldIncludeMapping(mapping)) {
      qualityFiltered++;
      skippedCount++;
      continue;
    }

    allMappings.push(mapping);

    if (processedCount % 1000 === 0) {
      console.log(`Processed ${processedCount} mappings (skipped ${skippedCount})`);
    }
  }

  // Group mappings by SNOMED code and effectiveTime
  console.log("Grouping mappings by SNOMED code and effectiveTime...");
  const groupedMappings = new Map<string, Map<string, SnomedToIcdMapping[]>>();

  for (const mapping of allMappings) {
    if (!groupedMappings.has(mapping.snomedCode)) {
      groupedMappings.set(mapping.snomedCode, new Map());
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const snomedGroup = groupedMappings.get(mapping.snomedCode)!;
    if (!snomedGroup.has(mapping.effectiveTime)) {
      snomedGroup.set(mapping.effectiveTime, []);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    snomedGroup.get(mapping.effectiveTime)!.push(mapping);
  }

  // Apply heuristic to select the best mapping for each SNOMED code
  console.log("Applying heuristic to select best mapping for each SNOMED code...");
  const finalMappings: SnomedToIcdMapping[] = [];
  let heuristicApplied = 0;

  for (const [, effectiveTimeGroups] of groupedMappings) {
    // Find the most recent effectiveTime for this SNOMED code
    const effectiveTimes = Array.from(effectiveTimeGroups.keys()).sort().reverse();
    const mostRecentEffectiveTime = effectiveTimes[0];

    // Get all mappings from the most recent effectiveTime
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mostRecentMappings = effectiveTimeGroups.get(mostRecentEffectiveTime)!;

    // Apply heuristic to select the best mapping
    const selectedMapping = selectBestMapping(mostRecentMappings);
    if (selectedMapping) {
      finalMappings.push(selectedMapping);
      heuristicApplied++;
    }
  }

  console.log(`- Heuristic applied to ${heuristicApplied} SNOMED codes`);
  console.log(`- Final mappings: ${finalMappings.length}`);

  console.log("Creating concept maps from selected mappings...");
  const mappedConcepts: Record<string, ConceptMap> = Object.create(null);
  let conceptMapCount = 0;

  for (const mapping of finalMappings) {
    try {
      const sourceDisplay = await lookupDisplay(client, SNOMED_SYSTEM, mapping.snomedCode);
      const targetDisplay = await lookupDisplay(client, ICD10CM_SYSTEM, mapping.icd10Code);

      const conceptMap = await createConceptMapFromSnomedMapping(
        mapping,
        sourceDisplay,
        targetDisplay
      );

      mappedConcepts[mapping.snomedCode] = conceptMap;
      conceptMapCount++;

      if (conceptMapCount % 1000 === 0) {
        console.log(`Created ${conceptMapCount} concept maps`);
      }
    } catch (error) {
      console.error(
        `Error processing mapping ${mapping.snomedCode} -> ${mapping.icd10Code}: ${error}`
      );
    }
  }

  console.log(`\nProcessing complete:`);
  console.log(`- Processed rows: ${processedCount}`);
  console.log(`- Active mappings: ${activeMappings}`);
  console.log(`- Inactive mappings: ${inactiveMappings}`);
  console.log(`- Other refset mappings: ${otherRefsetMappings}`);
  console.log(`- Quality filtered: ${qualityFiltered}`);
  console.log(`- Heuristic applied: ${heuristicApplied}`);
  console.log(`- Final concept maps: ${Object.keys(mappedConcepts).length}`);

  // Show sample concept maps before importing
  console.log(`\nSample concept maps created:`);
  let count = 0;
  for (const [key, conceptMap] of Object.entries(mappedConcepts)) {
    if (count >= 2) break; // Show first 2
    console.log(`\nSNOMED ${key}:`);
    console.log(JSON.stringify(conceptMap, null, 2));
    count++;
  }

  // Import all concept maps
  console.log(`\nAttempting to import ${Object.keys(mappedConcepts).length} concept maps...`);
  let importSuccess = 0;
  let importErrors = 0;

  for (const [key, conceptMap] of Object.entries(mappedConcepts)) {
    try {
      await client.importConceptMap(conceptMap, true);
      importSuccess++;
      if (importSuccess % 1000 === 0) {
        console.log(`Imported ${importSuccess} concept maps`);
      }
    } catch (error) {
      console.error(`✗ Error importing concept map for ${key}: ${error}`);
      importErrors++;
    }
  }

  console.log(`\nImport summary:`);
  console.log(`- Successfully imported: ${importSuccess}`);
  console.log(`- Import errors: ${importErrors}`);

  if (importErrors > 0) {
    console.log(
      `\nNote: Import errors may be due to terminology server not running or import endpoint not available.`
    );
    console.log(`Make sure the terminology server is running with: npm run start`);
  }
}

function getRowAsObject(row: string): SnomedIcd10MapRow {
  const [
    id,
    effectiveTime,
    active,
    moduleId,
    refsetId,
    referencedComponentId,
    mapGroup,
    mapPriority,
    mapRule,
    mapAdvice,
    mapTarget,
    correlationId,
    mapCategoryId,
  ] = row.split("\t");

  return {
    id,
    effectiveTime,
    active,
    moduleId,
    refsetId,
    referencedComponentId,
    mapGroup,
    mapPriority,
    mapRule,
    mapAdvice,
    mapTarget,
    correlationId,
    mapCategoryId,
  };
}

async function main(): Promise<void> {
  const [filePath] = argv.slice(2);
  if (!filePath) {
    return Promise.reject(
      new Error(
        "Missing argument: specify path to SNOMED CT to ICD-10-CM mapping file\nUsage: npm run seed-snomed-icd10 -- <filePath>"
      )
    );
  }

  console.log(`Processing SNOMED CT to ICD-10-CM mapping file: ${filePath}`);

  const inStream = createReadStream(filePath);
  await processSnomedIcd10Map(inStream);
}

main().catch(console.error);
