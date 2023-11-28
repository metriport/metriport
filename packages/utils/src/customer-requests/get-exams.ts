import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  Bundle,
  BundleEntry,
  Coding,
  Condition,
  MedicationRequest,
  Resource,
} from "@medplum/fhirtypes";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import fs from "fs";

dayjs.extend(duration);
dayjs.extend(isBetween);

/**
 * Query patients for Exams. This will:
 * - loop through patients in the list;
 * - for each patient:
 *   - query the patient's records;
 *   - count the number of MedicationRequest resources;
 *   - count the number of Condition resources with ICD-10 code Z00* and onset date within the last year;
 * - write the results to a CSV file.
 *
 * To run this script, set the env vars, the date range, system/exam code, and the list of patient IDs below.
 */

// The date range is inclusive on both ends
const fromDate = "2022-10-18";
const toDate = "2023-10-18";
// adjust according to the disired results
const systemsToSearchForVisits = ["icd-10"];
const examCode = "Z00";
// Make sure to set the patient IDs below
const patientIds: string[] = [];

const apiUrl = getEnvVarOrFail("API_URL");
// TODO update these to use `getCxData()` instead
const apiKey = getEnvVarOrFail("API_KEY");
const cxName = getEnvVarOrFail("CX_NAME");
const facilityId = getEnvVarOrFail("FACILITY_ID");
const minJitterMillis = 100;
const maxJitterMillis = 300;
const numberOfParallelExecutions = parseInt(getEnvVar("PARALLEL_QUERIES") ?? "5");
const curDateTime = new Date();
const runName = `${cxName.replaceAll(" ", "-")}_Exams_${curDateTime.toISOString()}`;
const baseDir = `./runs/${runName}`;
const patientCsvHeader = "id,records,medications,exams\n";

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
  timeout: 120_000,
});

function buildFileName(): string {
  return `${baseDir}/exam_${curDateTime.toISOString()}.csv`;
}

async function main() {
  console.log(`########################## Running... - started at ${new Date().toISOString()}`);
  const startedAt = Date.now();

  const listPatient = await metriportAPI.listPatients(facilityId);

  const patients = listPatient.filter(patient => patientIds.includes(patient.id));

  fs.mkdirSync(baseDir);
  console.log(`>>> Found ${patients.length} patients.`);
  const fileName = buildFileName();
  fs.writeFileSync(fileName, patientCsvHeader);

  const errors: { patientId: string; error: Error }[] = [];
  await executeAsynchronously(
    patients,
    async (patient, itemIndex, promiseIndex) => {
      const { log } = out(`${promiseIndex + 1}-${itemIndex + 1}`);
      try {
        const payload = await queryResourceForPatient(patient.id);
        fs.appendFileSync(fileName, createRow(payload).toString());
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        log(`Error getting resources for patient ${patient.id}`);
        errors.push({ patientId: patient.id, error });
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelExecutions,
      minJitterMillis,
      maxJitterMillis,
    }
  );
  console.log(`>>> Errors (${errors.length}):`);
  errors.forEach(e => console.log(`...patient ${e.patientId}: ${e.error.message}`));

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`########################## Total time: ${duration} ms / ${durationMin} min`);
}

async function queryResourceForPatient(patientId: string): Promise<{
  id: string;
  recordsCount: number;
  medicationCount: number;
  examCount: number;
}> {
  const records = await metriportAPI.getPatientConsolidated(patientId, [], fromDate, toDate);
  const medicationRequestCount = getMedicationRequests(records).length;
  const conditions = getConditions(records);
  const visitsForExam = conditions.length ? getVisitsForExam(conditions) : [];
  return {
    id: patientId,
    recordsCount: records.entry?.length ?? 0,
    medicationCount: medicationRequestCount ?? 0,
    examCount: visitsForExam.length,
  };
}

function getMedicationRequests(medicationRequests: Bundle<Resource>): MedicationRequest[] {
  return (medicationRequests.entry ?? []).flatMap(entry =>
    entry?.resource?.resourceType === "MedicationRequest" ? entry.resource : []
  );
}
function getConditions(records: Bundle<Resource>): Condition[] {
  return (records.entry ?? []).flatMap(entry =>
    entry?.resource?.resourceType === "Condition" ? entry.resource : []
  );
}

function getVisitsForExam(conditions: Condition[]): BundleEntry<Resource>[] {
  const visits = conditions.filter(condition => {
    const code = getSpecificCode(condition.code?.coding ?? [], systemsToSearchForVisits);
    if (!code) return false;
    return code.includes(examCode) && isWithinDateRange(condition.onsetDateTime);
  });
  return visits;
}

function isWithinDateRange(date: string | undefined): boolean {
  if (!date) return false;
  return dayjs(date).isBetween(fromDate, toDate, "day", "[]");
}

// return the first code that matches the system
// systemList should be in order of priority
function getSpecificCode(coding: Coding[], systemsList: string[]): string | null {
  let specifiedCode: string | null = null;

  if (systemsList.length) {
    for (const system of systemsList) {
      const code = coding.find(coding => {
        return coding.system?.toLowerCase().includes(system);
      })?.code;

      if (code && !specifiedCode) {
        specifiedCode = `${system.toUpperCase()}: ${code}`;
      }
    }
  }

  return specifiedCode;
}
type Row = {
  toString: () => string;
  data: Record<string, string | undefined>;
};

function createRow({
  id,
  recordsCount,
  medicationCount,
  examCount,
}: {
  id: string;
  recordsCount: number;
  medicationCount: number;
  examCount: number;
}): Row {
  const row = {
    id,
    recordFound: recordsCount > 0 ? "Yes" : "No",
    medicationsFound: medicationCount > 0 ? "Yes" : "No",
    examCount: examCount > 0 ? "Yes" : "No",
  };

  const rowAsString =
    `${row.id},` + `${row.recordFound},` + `${row.medicationsFound},` + `${row.examCount}\n`;
  return {
    toString: () => rowAsString,
    data: row,
  };
}

main();
