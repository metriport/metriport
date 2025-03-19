import { Bundle, Patient } from "@medplum/fhirtypes";
import * as fs from "fs/promises";
import path from "path";
import { processAllergies, formatAllergySummary } from "./allergy-processor";
import { processConditions, formatConditionSummary } from "./condition-processor";
import { processProcedures, formatProcedureSummary } from "./procedure-processor";
import { processSocialHistories, formatSocialHistorySummary } from "./social-history-processor";
import { processVitalSigns, formatVitalSignSummary } from "./vitals-processor";
import { processLabs, formatLabSummary } from "./laboratory-processor";
import { processImmunizations, formatImmunizationSummary } from "./immunization-processor";
import { processFamilyHistory, formatFamilyHistorySummary } from "./family-history-processor";
import { processEncounters, formatEncounterSummary } from "./encounter-processor";
import { processMedications, formatMedicationSummary } from "./medication-processor";
import { readAndConvertZusDirectory } from "./convert-zus-to-fhir";
const outputDir = "/Users/orta21/Documents/phi/form-health/fhir";
const metriportDir = "/Users/orta21/Documents/phi/form-health/metriport";

/**
 * Structure for CSV row data
 */
export type ResourceComparisonRow = {
  id: string;
  metriportTotal: number;
  uniqueMetriportTotal: number;
  metriportLastYearTotal: number;
  zusTotal: number;
  uniqueZusTotal: number;
  zusLastYearTotal: number;
  commonTotal: number;
  uniqueTotalWinner: string;
  lastYearWinner: string;
};

// Add this interface after the ResourceComparisonRow interface
interface PatientFileMapping {
  metriportFile: string;
  metriportBundle: Bundle;
  zusFile: string;
  zusBundle: Bundle;
  fileId: string;
  patientFirstName: string;
  patientLastName: string;
}

/**
 * Main function to be executed when running as a script
 */
const main = async (): Promise<void> => {
  try {
    const convertedFiles = await readAndConvertZusDirectory();

    await processResults(convertedFiles);

    console.log(`Successfully processed ${convertedFiles.length} files`);
    console.log(`Summary: All operations completed successfully`);
  } catch (error) {
    console.error("Conversion failed:", error);
    process.exit(1);
  }
};

const processResults = async (convertedFiles: string[]) => {
  try {
    const metriportFiles = await getMetriportJsonFiles();
    const mappings: PatientFileMapping[] = [];

    if (metriportFiles.length === 0) {
      console.warn("No Metriport files found to process");
      return mappings;
    }

    if (convertedFiles.length === 0) {
      console.warn("No converted Zus files found to process");
      return mappings;
    }

    const allergyRows: ResourceComparisonRow[] = [];
    const conditionRows: ResourceComparisonRow[] = [];
    const procedureRows: ResourceComparisonRow[] = [];
    const socialHistoryRows: ResourceComparisonRow[] = [];
    const vitalSignRows: ResourceComparisonRow[] = [];
    const labRows: ResourceComparisonRow[] = [];
    const immunizationRows: ResourceComparisonRow[] = [];
    const familyHistoryRows: ResourceComparisonRow[] = [];
    const encounterRows: ResourceComparisonRow[] = [];
    const medicationRows: ResourceComparisonRow[] = [];

    // Process Metriport files in parallel batches
    const batchSize = 10;
    for (let i = 0; i < metriportFiles.length; i += batchSize) {
      const batch = metriportFiles.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async metriportFile => {
          try {
            const bundles = await getMetriportToZusFhirBundles(metriportFile, convertedFiles);

            if (!bundles) {
              console.warn(`Skipping ${metriportFile}: no bundles found`);
              return null;
            }

            const {
              metriportBundle,
              zusBundle,
              patientFirstName,
              patientLastName,
              fileId: zusId,
            } = bundles;

            const fileId = `${metriportFile.split("_")[1]}_${zusId}`;

            const {
              encounterComparison,
              allergyComparison,
              conditionComparison,
              procedureComparison,
              immunizationComparison,
              familyHistoryComparison,
              socialHistoryComparison,
              vitalSignComparison,
              labComparison,
              medicationComparison,
            } = await compareBundlesAndGenerateSummary(
              metriportBundle,
              zusBundle,
              patientFirstName,
              patientLastName
            );

            encounterRows.push({
              id: fileId,
              metriportTotal: encounterComparison.metriport.count,
              uniqueMetriportTotal: encounterComparison.metriport.uniqueEncounters.length,
              metriportLastYearTotal: encounterComparison.metriport.encountersInLastYear.length,
              zusTotal: encounterComparison.zus.count,
              uniqueZusTotal: encounterComparison.zus.uniqueEncounters.length,
              zusLastYearTotal: encounterComparison.zus.encountersInLastYear.length,
              commonTotal: encounterComparison.common.count,
              uniqueTotalWinner: determineWinner(
                encounterComparison.metriport.uniqueEncounters.length,
                encounterComparison.zus.uniqueEncounters.length
              ),
              lastYearWinner: determineWinner(
                encounterComparison.metriport.encountersInLastYear.length,
                encounterComparison.zus.encountersInLastYear.length
              ),
            });

            allergyRows.push({
              id: fileId,
              metriportTotal: allergyComparison.metriport.count,
              uniqueMetriportTotal: allergyComparison.metriport.uniqueCount,
              metriportLastYearTotal: allergyComparison.metriport.allergiesInLastYear.length,
              zusTotal: allergyComparison.zus.count,
              uniqueZusTotal: allergyComparison.zus.uniqueCount,
              zusLastYearTotal: allergyComparison.zus.allergiesInLastYear.length,
              commonTotal: allergyComparison.common.count,
              uniqueTotalWinner: determineWinner(
                allergyComparison.metriport.uniqueCount,
                allergyComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                allergyComparison.metriport.allergiesInLastYear.length,
                allergyComparison.zus.allergiesInLastYear.length
              ),
            });

            conditionRows.push({
              id: fileId,
              metriportTotal: conditionComparison.metriport.count,
              uniqueMetriportTotal: conditionComparison.metriport.uniqueCount,
              metriportLastYearTotal: conditionComparison.metriport.conditionsInLastYear.length,
              zusTotal: conditionComparison.zus.count,
              uniqueZusTotal: conditionComparison.zus.uniqueCount,
              zusLastYearTotal: conditionComparison.zus.conditionsInLastYear.length,
              commonTotal: conditionComparison.common.count,
              uniqueTotalWinner: determineWinner(
                conditionComparison.metriport.uniqueCount,
                conditionComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                conditionComparison.metriport.conditionsInLastYear.length,
                conditionComparison.zus.conditionsInLastYear.length
              ),
            });

            socialHistoryRows.push({
              id: fileId,
              metriportTotal: socialHistoryComparison.metriport.count,
              uniqueMetriportTotal: socialHistoryComparison.metriport.uniqueCount,
              metriportLastYearTotal:
                socialHistoryComparison.metriport.socialHistoriesInLastYear.length,
              zusTotal: socialHistoryComparison.zus.count,
              uniqueZusTotal: socialHistoryComparison.zus.uniqueCount,
              zusLastYearTotal: socialHistoryComparison.zus.socialHistoriesInLastYear.length,
              commonTotal: socialHistoryComparison.common.count,
              uniqueTotalWinner: determineWinner(
                socialHistoryComparison.metriport.uniqueCount,
                socialHistoryComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                socialHistoryComparison.metriport.socialHistoriesInLastYear.length,
                socialHistoryComparison.zus.socialHistoriesInLastYear.length
              ),
            });

            medicationRows.push({
              id: fileId,
              metriportTotal: medicationComparison.metriport.count,
              uniqueMetriportTotal: medicationComparison.metriport.uniqueCount,
              metriportLastYearTotal: medicationComparison.metriport.medicationsInLastYear.length,
              zusTotal: medicationComparison.zus.count,
              uniqueZusTotal: medicationComparison.zus.uniqueCount,
              zusLastYearTotal: medicationComparison.zus.medicationsInLastYear.length,
              commonTotal: medicationComparison.common.count,
              uniqueTotalWinner: determineWinner(
                medicationComparison.metriport.uniqueCount,
                medicationComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                medicationComparison.metriport.medicationsInLastYear.length,
                medicationComparison.zus.medicationsInLastYear.length
              ),
            });

            vitalSignRows.push({
              id: fileId,
              metriportTotal: vitalSignComparison.metriport.count,
              uniqueMetriportTotal: vitalSignComparison.metriport.uniqueCount,
              metriportLastYearTotal: vitalSignComparison.metriport.vitalSignsInLastYear.length,
              zusTotal: vitalSignComparison.zus.count,
              uniqueZusTotal: vitalSignComparison.zus.uniqueCount,
              zusLastYearTotal: vitalSignComparison.zus.vitalSignsInLastYear.length,
              commonTotal: vitalSignComparison.common.count,
              uniqueTotalWinner: determineWinner(
                vitalSignComparison.metriport.uniqueCount,
                vitalSignComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                vitalSignComparison.metriport.vitalSignsInLastYear.length,
                vitalSignComparison.zus.vitalSignsInLastYear.length
              ),
            });

            familyHistoryRows.push({
              id: fileId,
              metriportTotal: familyHistoryComparison.metriport.count,
              uniqueMetriportTotal: familyHistoryComparison.metriport.uniqueCount,
              metriportLastYearTotal: 0, // Family history doesn't have dates in this model
              zusTotal: familyHistoryComparison.zus.count,
              uniqueZusTotal: familyHistoryComparison.zus.uniqueCount,
              zusLastYearTotal: 0, // Family history doesn't have dates in this model
              commonTotal: familyHistoryComparison.common.count,
              uniqueTotalWinner: determineWinner(
                familyHistoryComparison.metriport.uniqueCount,
                familyHistoryComparison.zus.uniqueCount
              ),
              lastYearWinner: "N/A", // Not applicable for family history
            });

            procedureRows.push({
              id: fileId,
              metriportTotal: procedureComparison.metriport.count,
              uniqueMetriportTotal: procedureComparison.metriport.uniqueCount,
              metriportLastYearTotal: procedureComparison.metriport.proceduresInLastYear.length,
              zusTotal: procedureComparison.zus.count,
              uniqueZusTotal: procedureComparison.zus.uniqueCount,
              zusLastYearTotal: procedureComparison.zus.proceduresInLastYear.length,
              commonTotal: procedureComparison.common.count,
              uniqueTotalWinner: determineWinner(
                procedureComparison.metriport.uniqueCount,
                procedureComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                procedureComparison.metriport.proceduresInLastYear.length,
                procedureComparison.zus.proceduresInLastYear.length
              ),
            });

            immunizationRows.push({
              id: fileId,
              metriportTotal: immunizationComparison.metriport.count,
              uniqueMetriportTotal: immunizationComparison.metriport.uniqueCount,
              metriportLastYearTotal:
                immunizationComparison.metriport.immunizationsInLastYear.length,
              zusTotal: immunizationComparison.zus.count,
              uniqueZusTotal: immunizationComparison.zus.uniqueCount,
              zusLastYearTotal: immunizationComparison.zus.immunizationsInLastYear.length,
              commonTotal: immunizationComparison.common.count,
              uniqueTotalWinner: determineWinner(
                immunizationComparison.metriport.uniqueCount,
                immunizationComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                immunizationComparison.metriport.immunizationsInLastYear.length,
                immunizationComparison.zus.immunizationsInLastYear.length
              ),
            });

            labRows.push({
              id: fileId,
              metriportTotal: labComparison.metriport.count,
              uniqueMetriportTotal: labComparison.metriport.uniqueCount,
              metriportLastYearTotal: labComparison.metriport.labsInLastYear.length,
              zusTotal: labComparison.zus.count,
              uniqueZusTotal: labComparison.zus.uniqueCount,
              zusLastYearTotal: labComparison.zus.labsInLastYear.length,
              commonTotal: labComparison.common.count,
              uniqueTotalWinner: determineWinner(
                labComparison.metriport.uniqueCount,
                labComparison.zus.uniqueCount
              ),
              lastYearWinner: determineWinner(
                labComparison.metriport.labsInLastYear.length,
                labComparison.zus.labsInLastYear.length
              ),
            });
          } catch (error) {
            console.error(`Error processing ${metriportFile}:`, error);
            return null;
          }
        })
      );
    }

    // Write CSV files in parallel instead of sequentially
    await Promise.all([
      writeCSV("allergy-comparison.csv", allergyRows, outputDir),
      writeCSV("condition-comparison.csv", conditionRows, outputDir),
      writeCSV("procedure-comparison.csv", procedureRows, outputDir),
      writeCSV("social-history-comparison.csv", socialHistoryRows, outputDir),
      writeCSV("vital-sign-comparison.csv", vitalSignRows, outputDir),
      writeCSV("laboratory-comparison.csv", labRows, outputDir),
      writeCSV("immunization-comparison.csv", immunizationRows, outputDir),
      writeCSV("family-history-comparison.csv", familyHistoryRows, outputDir),
      writeCSV("encounter-comparison.csv", encounterRows, outputDir),
      writeCSV("medication-comparison.csv", medicationRows, outputDir),
    ]);

    // Generate aggregate statistics
    await generateAggregateStatistics(
      allergyRows,
      conditionRows,
      procedureRows,
      socialHistoryRows,
      vitalSignRows,
      labRows,
      immunizationRows,
      familyHistoryRows,
      encounterRows,
      medicationRows,
      outputDir
    );
  } catch (error) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to build patient mappings: ${originalError.message}`, {
      cause: originalError,
    });
  }
};

const getMetriportToZusFhirBundles = async (
  metriportFile: string,
  convertedZusFiles: string[]
): Promise<{
  metriportBundle: Bundle;
  zusBundle: Bundle;
  fileId: string;
  patientFirstName: string;
  patientLastName: string;
} | null> => {
  const fileContent = await fs.readFile(metriportFile, "utf-8");
  const metriportBundle: Bundle = JSON.parse(fileContent);

  const patient = metriportBundle?.entry?.find(entry => entry.resource?.resourceType === "Patient")
    ?.resource as Patient;

  if (!patient) {
    console.warn(`Skipping ${metriportFile}: no patient found`);
    return null;
  }

  const patientFirstName = patient.name?.[0]?.given?.[0] ?? "";
  const patientLastName = patient.name?.[0]?.family ?? "";

  const processedFile = await processFileHasPatient(
    convertedZusFiles,
    patientFirstName,
    patientLastName
  );

  if (!processedFile?.bundle) {
    console.warn(`Skipping ${metriportFile}: no Zus file found for patient ${patientFirstName}`);
    return null;
  }

  return {
    metriportBundle,
    zusBundle: processedFile.bundle,
    fileId: processedFile.fileId,
    patientFirstName,
    patientLastName,
  };
};

const compareBundlesAndGenerateSummary = async (
  metriportBundle: Bundle,
  zusBundle: Bundle,
  patientFirstName: string,
  patientLastName: string
) => {
  const encounterComparison = processEncounters(metriportBundle, zusBundle);
  const allergyComparison = processAllergies(metriportBundle, zusBundle);
  const conditionComparison = processConditions(metriportBundle, zusBundle);
  const procedureComparison = processProcedures(metriportBundle, zusBundle);
  const immunizationComparison = processImmunizations(metriportBundle, zusBundle);
  const familyHistoryComparison = processFamilyHistory(metriportBundle, zusBundle);
  const socialHistoryComparison = processSocialHistories(metriportBundle, zusBundle);
  const vitalSignComparison = processVitalSigns(metriportBundle, zusBundle);
  const labComparison = processLabs(metriportBundle, zusBundle);
  const medicationComparison = processMedications(metriportBundle, zusBundle);

  const encounterSummary = formatEncounterSummary(encounterComparison);
  const allergySummary = formatAllergySummary(allergyComparison);
  const conditionSummary = formatConditionSummary(conditionComparison);
  const procedureSummary = formatProcedureSummary(procedureComparison);
  const immunizationSummary = formatImmunizationSummary(immunizationComparison);
  const familyHistorySummary = formatFamilyHistorySummary(familyHistoryComparison);
  const socialHistorySummary = formatSocialHistorySummary(socialHistoryComparison);
  const vitalSignSummary = formatVitalSignSummary(vitalSignComparison);
  const labSummary = formatLabSummary(labComparison);
  const medicationSummary = formatMedicationSummary(medicationComparison);

  const combinedSummary =
    `# Patient Summary for ${patientFirstName} ${patientLastName}\n\n` +
    `## Allergies\n\n${allergySummary}\n\n` +
    `## Conditions\n\n${conditionSummary}\n\n` +
    `## Medications\n\n${medicationSummary}\n\n` +
    `## Procedures\n\n${procedureSummary}\n\n` +
    `## Immunizations\n\n${immunizationSummary}\n\n` +
    `## Family History\n\n${familyHistorySummary}\n\n` +
    `## Encounters\n\n${encounterSummary}\n\n` +
    `## Social History Comparison\n\n${socialHistorySummary}\n\n` +
    `## Vital Signs Comparison\n\n${vitalSignSummary}\n\n` +
    `## Laboratory Results Comparison\n\n${labSummary}`;

  // Create a single output file for the combined summary in the patient directory
  const summaryOutputPath = path.join(
    outputDir,
    `${patientFirstName}_${patientLastName}_medical_summary.md`
  );

  await fs.writeFile(summaryOutputPath, combinedSummary);

  return {
    encounterComparison,
    allergyComparison,
    conditionComparison,
    procedureComparison,
    immunizationComparison,
    familyHistoryComparison,
    socialHistoryComparison,
    vitalSignComparison,
    labComparison,
    medicationComparison,
  };
};

/**
 * Retrieves all JSON files from the Metriport directory
 */
export const getMetriportJsonFiles = async (): Promise<string[]> => {
  try {
    // Use the existing findJsonFiles function to recursively find all JSON files
    const jsonFiles = await findJsonFiles(metriportDir);

    if (jsonFiles.length === 0) {
      console.warn(`No JSON files found in ${metriportDir}`);
      return [];
    }

    return jsonFiles;
  } catch (error) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to get Metriport JSON files: ${originalError.message}`, {
      cause: originalError,
    });
  }
};

/**
 * Recursively finds all JSON files in the provided directory
 */
const findJsonFiles = async (dir: string): Promise<string[]> => {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      const subDirFiles = await findJsonFiles(fullPath);
      files.push(...subDirFiles);
    } else if (item.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
};

const processFileHasPatient = async (
  convertedFiles: string[],
  firstName: string,
  lastName: string
): Promise<{ bundle: Bundle; fileId: string } | undefined> => {
  // Create a search string for efficient matching
  const fullName = `${firstName} ${lastName}`;

  // Process files in parallel with a concurrency limit to avoid overwhelming the system
  const concurrencyLimit = 50;
  const chunks = [];

  for (let i = 0; i < convertedFiles.length; i += concurrencyLimit) {
    const chunk = convertedFiles.slice(i, i + concurrencyLimit);
    chunks.push(chunk);
  }

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async file => {
        try {
          // Use a streaming approach to check if file contains the patient name
          const fileContainsPatient = await checkFileContainsText(file, fullName);

          if (!fileContainsPatient) {
            return null;
          }

          // Only read and parse the file if it potentially contains the patient
          const fileContent = await fs.readFile(file, "utf8");
          return {
            bundle: JSON.parse(fileContent) as Bundle,
            fileId: path.basename(file, ".json"),
          };
        } catch (error) {
          console.error(`Error processing file ${file}:`, (error as Error).message);
          return null;
        }
      })
    );

    // Return the first non-null result
    const match = results.find(result => result !== null);
    if (match) {
      return match;
    }
  }

  return undefined;
};

/**
 * Efficiently checks if a file contains specific text without loading the entire file
 * into memory at once. Uses a streaming approach to minimize memory usage.
 */
const checkFileContainsText = async (filePath: string, searchText: string): Promise<boolean> => {
  const chunkSize = 64 * 1024; // 64KB chunks for efficient reading
  const buffer = Buffer.alloc(chunkSize);

  try {
    const fileHandle = await fs.open(filePath, "r");
    let bytesRead = 0;
    let position = 0;
    let found = false;

    // Read file in chunks to avoid loading the whole file into memory
    while (!found) {
      bytesRead = (await fileHandle.read(buffer, 0, chunkSize, position)).bytesRead;
      if (bytesRead === 0) break; // Reached end of file

      // Convert buffer to string and check if it contains the search text
      const chunk = buffer.slice(0, bytesRead).toString();
      if (chunk.includes(searchText)) {
        found = true;
      }

      position += bytesRead;
    }

    await fileHandle.close();
    return found;
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, (error as Error).message);
    return false;
  }
};

/**
 * Determines which source is the winner based on counts
 */
const determineWinner = (metriportCount: number, zusCount: number): string => {
  if (metriportCount > zusCount) {
    return "Metriport";
  } else if (zusCount > metriportCount) {
    return "Zus";
  } else {
    return "Tie";
  }
};

/**
 * Writes CSV file from data rows
 */
const writeCSV = async (
  fileName: string,
  rows: ResourceComparisonRow[],
  outputDir: string
): Promise<void> => {
  const filePath = path.join(outputDir, fileName);
  const headers = [
    "Id",
    "Metriport Total",
    "Unique Metriport Total",
    "Metriport in Last Year Total",
    "Zus Total",
    "Unique Zus Total",
    "Zus in Last Year Total",
    "Common Total",
    "Unique Total Winner",
    "Last Year Winner",
  ].join(",");

  // Always overwrite with new data
  let csvContent = headers + "\n";
  for (const row of rows) {
    csvContent += `${row.id},${row.metriportTotal},${row.uniqueMetriportTotal},${row.metriportLastYearTotal},${row.zusTotal},${row.uniqueZusTotal},${row.zusLastYearTotal},${row.commonTotal},${row.uniqueTotalWinner},${row.lastYearWinner}\n`;
  }

  await fs.writeFile(filePath, csvContent);
};

/**
 * Generates aggregate statistics across all patients for each resource type
 */
const generateAggregateStatistics = async (
  allergyRows: ResourceComparisonRow[],
  conditionRows: ResourceComparisonRow[],
  procedureRows: ResourceComparisonRow[],
  socialHistoryRows: ResourceComparisonRow[],
  vitalSignRows: ResourceComparisonRow[],
  labRows: ResourceComparisonRow[],
  immunizationRows: ResourceComparisonRow[],
  familyHistoryRows: ResourceComparisonRow[],
  encounterRows: ResourceComparisonRow[],
  medicationRows: ResourceComparisonRow[],
  outputDir: string
): Promise<void> => {
  try {
    // Define the structure for aggregate statistics
    interface AggregateStats {
      resourceType: string;
      hasMoreCoverage: string;
      hasMoreUniqueTotal: string;
      hasMoreLastYear: string;
    }

    // Function to calculate stats for a resource type
    const calculateStats = (
      rows: ResourceComparisonRow[],
      resourceType: string
    ): AggregateStats => {
      const totalPatients = rows.length;
      let metriportMoreUniqueTotal = 0;
      let zusMoreUniqueTotal = 0;
      let tieUniqueTotal = 0;
      let metriportMoreLastYear = 0;
      let zusMoreLastYear = 0;
      let tieLastYear = 0;
      let notApplicableLastYear = 0;

      // New counters for exclusive coverage
      let metriportExclusiveCoverage = 0; // Metriport has resources but Zus doesn't
      let zusExclusiveCoverage = 0; // Zus has resources but Metriport doesn't
      let bothHaveCoverage = 0; // Both have resources
      let neitherHasCoverage = 0; // Neither has resources

      rows.forEach(row => {
        // Calculate exclusive coverage
        if (row.metriportTotal > 0 && row.zusTotal === 0) {
          metriportExclusiveCoverage++;
        } else if (row.zusTotal > 0 && row.metriportTotal === 0) {
          zusExclusiveCoverage++;
        } else if (row.metriportTotal > 0 && row.zusTotal > 0) {
          bothHaveCoverage++;
        } else {
          neitherHasCoverage++;
        }

        // Rest of the counting logic remains the same
        if (row.uniqueTotalWinner === "Metriport") {
          metriportMoreUniqueTotal++;
        } else if (row.uniqueTotalWinner === "Zus") {
          zusMoreUniqueTotal++;
        } else {
          tieUniqueTotal++;
        }

        // Count last year winners
        if (row.lastYearWinner === "Metriport") {
          metriportMoreLastYear++;
        } else if (row.lastYearWinner === "Zus") {
          zusMoreLastYear++;
        } else if (row.lastYearWinner === "Tie") {
          tieLastYear++;
        } else if (row.lastYearWinner === "N/A") {
          notApplicableLastYear++;
        }
      });

      // Calculate exclusive coverage percentages
      const metriportExclusivePercent = (metriportExclusiveCoverage / totalPatients) * 100;
      const zusExclusivePercent = (zusExclusiveCoverage / totalPatients) * 100;
      const bothCoveragePercent = (bothHaveCoverage / totalPatients) * 100;
      const neitherCoveragePercent = (neitherHasCoverage / totalPatients) * 100;

      // Format coverage stats to show exclusive coverage percentages with net benefit
      let hasMoreCoverage = "";
      if (metriportExclusivePercent >= zusExclusivePercent) {
        // Metriport wins - calculate net benefit
        const netBenefit = metriportExclusivePercent - zusExclusivePercent;
        hasMoreCoverage =
          `"WINNER: Metriport +${netBenefit.toFixed(1)}%\n` +
          `Metriport only: ${metriportExclusiveCoverage}/${totalPatients} (${metriportExclusivePercent.toFixed(
            1
          )}%)\n` +
          `Zus only: ${zusExclusiveCoverage}/${totalPatients} (${zusExclusivePercent.toFixed(
            1
          )}%)\n` +
          `Both have: ${bothHaveCoverage}/${totalPatients} (${bothCoveragePercent.toFixed(1)}%)\n` +
          `Neither has: ${neitherHasCoverage}/${totalPatients} (${neitherCoveragePercent.toFixed(
            1
          )}%)"`;
      } else {
        // Zus wins - calculate net benefit
        const netBenefit = zusExclusivePercent - metriportExclusivePercent;
        hasMoreCoverage =
          `"WINNER: Zus +${netBenefit.toFixed(1)}%\n` +
          `Metriport only: ${metriportExclusiveCoverage}/${totalPatients} (${metriportExclusivePercent.toFixed(
            1
          )}%)\n` +
          `Zus only: ${zusExclusiveCoverage}/${totalPatients} (${zusExclusivePercent.toFixed(
            1
          )}%)\n` +
          `Both have: ${bothHaveCoverage}/${totalPatients} (${bothCoveragePercent.toFixed(1)}%)\n` +
          `Neither has: ${neitherHasCoverage}/${totalPatients} (${neitherCoveragePercent.toFixed(
            1
          )}%)"`;
      }

      // Calculate unique total percentages
      const metriportUniquePercent = (metriportMoreUniqueTotal / totalPatients) * 100;
      const zusUniquePercent = (zusMoreUniqueTotal / totalPatients) * 100;
      const tieUniquePercent = (tieUniqueTotal / totalPatients) * 100;

      let hasMoreUniqueTotal = "";
      if (metriportUniquePercent >= zusUniquePercent) {
        // Metriport wins - calculate net benefit
        const netBenefit = metriportUniquePercent - zusUniquePercent;
        hasMoreUniqueTotal =
          `"WINNER: Metriport +${netBenefit.toFixed(1)}%\n` +
          `Metriport wins: ${metriportMoreUniqueTotal}/${totalPatients} (${metriportUniquePercent.toFixed(
            1
          )}%)\n` +
          `Zus wins: ${zusMoreUniqueTotal}/${totalPatients} (${zusUniquePercent.toFixed(1)}%)\n` +
          `Ties: ${tieUniqueTotal}/${totalPatients} (${tieUniquePercent.toFixed(1)}%)"`;
      } else {
        // Zus wins - calculate net benefit
        const netBenefit = zusUniquePercent - metriportUniquePercent;
        hasMoreUniqueTotal =
          `"WINNER: Zus +${netBenefit.toFixed(1)}%\n` +
          `Metriport wins: ${metriportMoreUniqueTotal}/${totalPatients} (${metriportUniquePercent.toFixed(
            1
          )}%)\n` +
          `Zus wins: ${zusMoreUniqueTotal}/${totalPatients} (${zusUniquePercent.toFixed(1)}%)\n` +
          `Ties: ${tieUniqueTotal}/${totalPatients} (${tieUniquePercent.toFixed(1)}%)"`;
      }

      // Format last year stats with percentages
      const lastYearTotal = totalPatients - notApplicableLastYear;
      let hasMoreLastYear = "";

      if (notApplicableLastYear === totalPatients) {
        hasMoreLastYear = `"N/A"`;
      } else {
        // Calculate percentages based on applicable patients (excluding N/A)
        const metriportLastYearPercent = (metriportMoreLastYear / lastYearTotal) * 100;
        const zusLastYearPercent = (zusMoreLastYear / lastYearTotal) * 100;
        const tieLastYearPercent = (tieLastYear / lastYearTotal) * 100;
        const naPercent =
          notApplicableLastYear > 0 ? (notApplicableLastYear / totalPatients) * 100 : 0;

        if (metriportLastYearPercent >= zusLastYearPercent) {
          // Metriport wins - calculate net benefit
          const netBenefit = metriportLastYearPercent - zusLastYearPercent;
          const naText =
            notApplicableLastYear > 0
              ? `\nN/A: ${notApplicableLastYear}/${totalPatients} (${naPercent.toFixed(1)}%)`
              : "";

          hasMoreLastYear =
            `"WINNER: Metriport +${netBenefit.toFixed(1)}%\n` +
            `Metriport wins: ${metriportMoreLastYear}/${lastYearTotal} (${metriportLastYearPercent.toFixed(
              1
            )}%)\n` +
            `Zus wins: ${zusMoreLastYear}/${lastYearTotal} (${zusLastYearPercent.toFixed(1)}%)\n` +
            `Ties: ${tieLastYear}/${lastYearTotal} (${tieLastYearPercent.toFixed(1)}%)${naText}"`;
        } else {
          // Zus wins - calculate net benefit
          const netBenefit = zusLastYearPercent - metriportLastYearPercent;
          const naText =
            notApplicableLastYear > 0
              ? `\nN/A: ${notApplicableLastYear}/${totalPatients} (${naPercent.toFixed(1)}%)`
              : "";

          hasMoreLastYear =
            `"WINNER: Zus +${netBenefit.toFixed(1)}%\n` +
            `Metriport wins: ${metriportMoreLastYear}/${lastYearTotal} (${metriportLastYearPercent.toFixed(
              1
            )}%)\n` +
            `Zus wins: ${zusMoreLastYear}/${lastYearTotal} (${zusLastYearPercent.toFixed(1)}%)\n` +
            `Ties: ${tieLastYear}/${lastYearTotal} (${tieLastYearPercent.toFixed(1)}%)${naText}"`;
        }
      }

      return {
        resourceType,
        hasMoreCoverage,
        hasMoreUniqueTotal,
        hasMoreLastYear,
      };
    };

    // Calculate stats for each resource type
    const aggregateStats: AggregateStats[] = [
      calculateStats(allergyRows, "Allergies"),
      calculateStats(conditionRows, "Conditions"),
      calculateStats(procedureRows, "Procedures"),
      calculateStats(socialHistoryRows, "Social Histories"),
      calculateStats(vitalSignRows, "Vital Signs"),
      calculateStats(labRows, "Laboratory Results"),
      calculateStats(immunizationRows, "Immunizations"),
      calculateStats(familyHistoryRows, "Family Histories"),
      calculateStats(encounterRows, "Encounters"),
      calculateStats(medicationRows, "Medications"),
    ];

    // Write aggregate stats to CSV
    const filePath = path.join(outputDir, "aggregate-statistics.csv");
    const headers = [
      "Resource Type",
      "Has More Coverage",
      "Has More Unique Total",
      "Has More Last Year",
    ].join(",");

    let csvContent = headers + "\n";
    for (const stat of aggregateStats) {
      csvContent +=
        [
          stat.resourceType,
          stat.hasMoreCoverage,
          stat.hasMoreUniqueTotal,
          stat.hasMoreLastYear,
        ].join(",") + "\n";
    }

    await fs.writeFile(filePath, csvContent);
    console.log("Generated aggregate statistics CSV");
  } catch (error) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to generate aggregate statistics: ${originalError.message}`, {
      cause: originalError,
    });
  }
};

main();
