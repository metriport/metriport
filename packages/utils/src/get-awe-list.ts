import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, PatientDTO } from "@metriport/api-sdk";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import fs from "fs";
import dayjs from "dayjs";
import { Condition } from "@medplum/fhirtypes";

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const delayTime = parseInt(getEnvVar("BULK_INSERT_DELAY_TIME") ?? "200");
const numberOfParallelExecutions = parseInt(getEnvVar("PARALLEL_QUERIES") ?? "10");
const csvHeader = "id,firstName,lastName,dob,genderAtBirth,latestAWEDate,aweInPastYear\n";
const curDateTime = new Date();
const runName = `Z00s-${curDateTime.toISOString()}`;
const baseDir = `./${runName}`;
const patientWhitelist: string[] = [];

function buildCSVFileName(): string {
  return `${baseDir}/_Z00s.csv`;
}

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

// find latest Z00 codes per patient
async function getAllAWEs() {
  fs.mkdirSync(baseDir);
  const csvFileName = buildCSVFileName();
  fs.writeFileSync(csvFileName, csvHeader);
  const errors: { patientId: string; error: Error }[] = [];

  const facilities = await metriportAPI.listFacilities();
  for (const facility of facilities) {
    let patients = await metriportAPI.listPatients(facility.id);
    patients = patients.filter(p => patientWhitelist.includes(p.id));
    await executeAsynchronously(
      patients,
      async (patient, itemIndex, promiseIndex) => {
        const { log } = out(`${promiseIndex + 1}-${itemIndex + 1}`);
        try {
          // list all of the patient's conditions
          console.log(`>>> Getting Conditions for Patient ${patient.id}`);
          const conditions = await metriportAPI.getPatientConsolidated(patient.id, ["Condition"]);
          let latestAWECondition: Condition | undefined;
          // get the latest condition with a Z00 code (this will be an AWE)
          if (conditions.entry) {
            const conditionResources = conditions.entry;
            for (const condition of conditionResources) {
              if (!condition.resource) continue;
              const conditionResource = condition.resource as Condition;
              const conditionResourceJSON = JSON.stringify(conditionResource);
              if (conditionResourceJSON.includes("Z00")) {
                if (latestAWECondition) {
                  if (
                    (latestAWECondition.onsetDateTime &&
                      conditionResource.onsetDateTime &&
                      dayjs(conditionResource.onsetDateTime).isAfter(
                        latestAWECondition.onsetDateTime
                      )) ||
                    (!latestAWECondition.onsetDateTime && conditionResource.onsetDateTime)
                  ) {
                    latestAWECondition = conditionResource;
                  }
                } else {
                  latestAWECondition = conditionResource;
                }
                console.log(latestAWECondition.onsetDateTime);
              }
            }
          }

          if (latestAWECondition) {
            console.log(`>>> Found AWE for Patient ${patient.id}`);
          } else {
            console.log(`>>> Didn't find AWE for Patient ${patient.id}`);
          }
          fs.appendFileSync(csvFileName, createCSVRow(patient, latestAWECondition).toString());
          log(`Sleeping for ${delayTime} ms before the next patient...`);
          await sleep(delayTime);
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          log(`Error getting Conditions for patient ${patient.id}`);
          errors.push({ patientId: patient.id, error });
        }
      },
      {
        numberOfParallelExecutions: numberOfParallelExecutions,
      }
    );
  }
  console.log(`>>> Done!`);
  console.log(`>>> Errors (${errors.length}):`);
  errors.forEach(e => console.log(`...patient ${e.patientId}: ${e.error.message}`));
}

function clean(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/,/g, " -").replace(/\s|\n|\r/g, " ");
}

type Row = {
  toString: () => string;
  data: Record<string, string | undefined>;
};

function createAWERow(condition?: Condition): Row {
  const oneYearAgo = dayjs(curDateTime).subtract(1, "year");
  const aweRow = condition
    ? {
        latestAWEDate: clean(condition.onsetDateTime) ?? "none",
        aweInPastYear:
          condition.onsetDateTime && dayjs(condition.onsetDateTime).isAfter(oneYearAgo)
            ? "YES"
            : "NO",
      }
    : {
        latestAWEDate: "none",
        aweInPastYear: "NO",
      };

  const rowAsString = `${aweRow.latestAWEDate},` + `${aweRow.aweInPastYear}\n`;
  return {
    toString: () => rowAsString,
    data: aweRow,
  };
}

function createCSVRow(patient: PatientDTO, condition?: Condition): Row {
  const aweRow = createAWERow(condition);
  const patientRow = {
    id: clean(patient.id),
    firstName: clean(patient.firstName),
    lastName: clean(patient.lastName),
    dob: clean(patient.dob),
    genderAtBirth: clean(patient.genderAtBirth),
    ...aweRow.data,
  };

  const rowAsString =
    `${patientRow.id},` +
    `${patientRow.firstName},` +
    `${patientRow.lastName},` +
    `${patientRow.dob},` +
    `${patientRow.genderAtBirth},` +
    `${aweRow.toString()}`;
  return {
    toString: () => rowAsString,
    data: patientRow,
  };
}

// scripts to execute:
getAllAWEs();
