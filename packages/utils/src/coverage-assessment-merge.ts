import csv from "csv-parser";
import fs from "fs";
import { mapHeadersForCsvParser } from "./csv/shared";
import { initFile } from "./shared/file";
import { buildGetDirPathInside } from "./shared/folder";

/**
 * Merges two Coverage Assessment output files.
 * When it finds a duplicate ID, it chooses the one with the most FHIR resources.
 *
 * Usage:
 * - set the cxName
 * - set the firstCaFilePath
 * - set the secondCaFilePath
 * - run the script
 *   > ts-node src/coverage-assessment-merge.ts
 *
 * Output:
 * - Creates a timestamped folder under runs/coverage-assessment-merge/<cxName>
 * - Generates a CSV file with the merged results
 * - Generates a text file with the missing external IDs
 */

const firstCaFilePath = "";
const secondCaFilePath = "";
const cxName = "";

const getOutputFileName = buildGetDirPathInside(`coverage-assessment-merge`);
const outputFileName = getOutputFileName(cxName) + ".csv";
initFile(outputFileName);

/**
 * Finds duplicate IDs in a CSV file where IDs are in the first column
 */
async function main() {
  const firstRecords: CaRecord[] = [];
  const firstErrors: Array<{ row: string; errors: string }> = [];

  const secondRecords: CaRecord[] = [];
  const secondErrors: Array<{ row: string; errors: string }> = [];

  const firstPromise = new Promise<void>(resolve => {
    fs.createReadStream(firstCaFilePath)
      .pipe(csv({ mapHeaders: mapHeadersForCsvParser }))
      .on("data", onData(firstRecords, firstErrors))
      .on("end", async () => {
        console.log(`Read ${firstRecords.length} patients from first CA`);
        console.log(`Found ${firstErrors.length} mapping errors in first CA`);
        resolve();
      });
  });

  const secondPromise = new Promise<void>(resolve => {
    fs.createReadStream(secondCaFilePath)
      .pipe(csv({ mapHeaders: mapHeadersForCsvParser }))
      .on("data", onData(secondRecords, secondErrors))
      .on("end", async () => {
        console.log(`Read ${secondRecords.length} patients from second CA`);
        console.log(`Found ${secondErrors.length} mapping errors in second CA`);
        resolve();
      });
  });

  await Promise.all([firstPromise, secondPromise]);

  const result: Record<string, CaRecord> = {};
  const missingExternalIds: CaRecord[] = [];

  for (const record of firstRecords) {
    if (!record.externalId) {
      console.log(
        `No external ID for fist CA: first ${record.firstName}, last ${record.lastName}, state ${record.state}`
      );
      missingExternalIds.push(record);
      continue;
    }
    const recordOnSecondCa = secondRecords.find(r => r.externalId === record.externalId);
    if (!recordOnSecondCa) {
      result[record.externalId] = record;
      continue;
    }
    const firstResCount = record.fhirResourceCount;
    const secondResCount = recordOnSecondCa.fhirResourceCount;
    if (firstResCount > secondResCount) {
      result[record.externalId] = record;
    } else {
      result[record.externalId] = recordOnSecondCa;
    }
  }

  fs.writeFileSync(outputFileName, caRecordFields.join(",") + "\n");
  const resultEntries = Object.entries(result);
  resultEntries.forEach(([externalId, r]) => {
    const {
      patientId,
      firstName,
      lastName,
      state,
      downloadStatus,
      docCount,
      convertStatus,
      fhirResourceCount,
      fhirResourceDetails,
    } = r;
    fs.appendFileSync(
      outputFileName,
      `${externalId},${patientId},${firstName},${lastName},${state},${downloadStatus},${docCount},${convertStatus},${fhirResourceCount},${fhirResourceDetails}\n`
    );
  });
  fs.writeFileSync(
    outputFileName + "_missingExternalIds.txt",
    missingExternalIds.map(r => r.externalId).join("\n")
  );
  fs.writeFileSync(outputFileName + "_firstErrors.txt", firstErrors.map(e => e.row).join("\n"));
  fs.writeFileSync(outputFileName + "_secondErrors.txt", secondErrors.map(e => e.row).join("\n"));
}

const caRecordFields = [
  "externalId",
  "patientId",
  "firstName",
  "lastName",
  "state",
  "downloadStatus",
  "docCount",
  "convertStatus",
  "fhirResourceCount",
  "fhirResourceDetails",
] as const;

type CaRecord = {
  [K in (typeof caRecordFields)[number]]: K extends
    | "patientId"
    | "downloadStatus"
    | "docCount"
    | "convertStatus"
    | "fhirResourceCount"
    | "fhirResourceDetails"
    ? K extends "docCount" | "fhirResourceCount"
      ? number
      : string
    : string | undefined;
};

function onData(records: CaRecord[], errors: Array<{ row: string; errors: string }>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data: any) => {
    const result = mapCaRecord(data);
    if (Array.isArray(result)) {
      errors.push({
        row: JSON.stringify(data),
        errors: result.map(e => e.error).join("; "),
      });
    } else {
      records.push(result);
    }
  };
}

function mapCaRecord(csvPatient: {
  patientid: string;
  externalid: string;
  firstname: string;
  lastname: string;
  state: string;
  downloadstatus: string;
  doccount: number;
  convertstatus: string;
  fhirresourcecount: number;
  fhirresourcedetails: string;
}): CaRecord {
  return {
    externalId: csvPatient.externalid,
    patientId: csvPatient.patientid,
    firstName: csvPatient.firstname,
    lastName: csvPatient.lastname,
    state: csvPatient.state,
    downloadStatus: csvPatient.downloadstatus,
    docCount: csvPatient.doccount,
    convertStatus: csvPatient.convertstatus,
    fhirResourceCount: csvPatient.fhirresourcecount,
    fhirResourceDetails: csvPatient.fhirresourcedetails,
  };
}

if (require.main === module) {
  main();
}
