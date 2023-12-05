import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MedicationRequest } from "@medplum/fhirtypes";
import { MetriportMedicalApi, PatientDTO } from "@metriport/api-sdk";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import fs from "fs";
import { orderBy } from "lodash";

const fromDate = "2022-10-12"; // TODO make this dynamic, maybe number of months, with a default of 6 months?
// TODO update these to use `getCxData()` instead
const apiUrl = getEnvVarOrFail("API_URL");
const apiKey = getEnvVarOrFail("API_KEY");
const cxName = getEnvVarOrFail("CX_NAME");
const facilityId = getEnvVarOrFail("FACILITY_ID");
const delayTime = parseInt(getEnvVar("BULK_INSERT_DELAY_TIME") ?? "200");
const numberOfParallelExecutions = parseInt(getEnvVar("PARALLEL_QUERIES") ?? "5");
const resourceType = "MedicationRequest";
const dateFormat = "YYYY-MM-DD";

const patientCsvHeader = "date,status,medication,dosage,quantity\n";
const consolidatedCsvHeader = "id,firstName,lastName,dob,genderAtBirth," + patientCsvHeader;
const curDateTime = new Date();
const runName = `${cxName.replaceAll(" ", "-")}_Medications_${curDateTime.toISOString()}`;
const baseDir = `./runs/${runName}`;

const patientIds: string[] = [];

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

function buildPatientFileName(patientId: string): string {
  return `${baseDir}/patient-medication-${patientId}.csv`;
}
function buildConsolidatedFileName(): string {
  return `${baseDir}/_consolidated-medication.csv`;
}

async function main() {
  const listPatient = await metriportAPI.listPatients(facilityId);

  const patients = listPatient.filter(patient => patientIds.includes(patient.id));

  console.log(`>>> Found ${patients.length} patients.`);
  fs.mkdirSync(baseDir);
  const consolidatedFileName = buildConsolidatedFileName();
  fs.writeFileSync(consolidatedFileName, consolidatedCsvHeader);

  let totalResources = 0;
  const errors: { patientId: string; error: Error }[] = [];
  await executeAsynchronously(
    patients,
    async (patient, itemIndex, promiseIndex) => {
      const { log } = out(`${promiseIndex + 1}-${itemIndex + 1}`);
      try {
        const resourceList = await queryResourceForPatient(patient.id);
        log(`Got ${resourceList.length} ${resourceType} for patient ${patient.id}`);

        if (resourceList.length > 0) {
          const patientFileName = buildPatientFileName(patient.id);
          fs.writeFileSync(patientFileName, patientCsvHeader);

          const convertAuthoredOnToDate = resourceList.map(medication => {
            return {
              ...medication,
              authoredOn: medication.authoredOn
                ? new Date(medication.authoredOn.toString())
                : undefined,
            };
          });

          const sortMedicationListByDate = orderBy(
            convertAuthoredOnToDate,
            ["authoredOn"],
            ["desc"]
          );

          const convertDate = sortMedicationListByDate.map(medication => {
            return {
              ...medication,
              authoredOn: medication.authoredOn
                ? dayjs(medication.authoredOn).format(dateFormat)
                : undefined,
            };
          });

          const moveUndefinedToTheEnd = convertDate.sort((a, b) => {
            if (a.authoredOn === undefined) return 1;
            if (b.authoredOn === undefined) return -1;
            return 0;
          });

          totalResources += moveUndefinedToTheEnd.length;
          moveUndefinedToTheEnd.forEach(medication => {
            fs.appendFileSync(patientFileName, createMedicationRow(medication).toString());
            fs.appendFileSync(
              consolidatedFileName,
              createConsolidatedRow(patient, medication).toString()
            );
          });
        }
        log(`Sleeping for ${delayTime} ms before the next patient...`);
        await sleep(delayTime);
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        log(`Error getting ${resourceType} for patient ${patient.id}`);
        errors.push({ patientId: patient.id, error });
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelExecutions,
    }
  );
  console.log(`>>> Found ${totalResources} ${resourceType} for ${patients.length} patients.`);
  console.log(`>>> Errors (${errors.length}):`);
  errors.forEach(e => console.log(`...patient ${e.patientId}: ${e.error.message}`));
}

async function queryResourceForPatient(patientId: string): Promise<MedicationRequest[]> {
  const medicationRequests = await metriportAPI.getPatientConsolidated(
    patientId,
    [resourceType],
    fromDate
  );
  return (medicationRequests.entry ?? []).flatMap(entry =>
    entry?.resource?.resourceType === resourceType ? entry.resource : []
  );
}

type Row = {
  toString: () => string;
  data: Record<string, string | undefined>;
};

function clean(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/,/g, " -").replace(/\s|\n|\r/g, " ");
}

function createMedicationRow(medication: MedicationRequest): Row {
  const medicationRow = {
    date: clean(medication.authoredOn) ?? "NA",
    status: clean(medication.status) ?? "",
    medication: clean(medication.medicationCodeableConcept?.text) ?? "NA",
    dosage: clean(medication.dosageInstruction?.[0].text) ?? "NA",
    quantity: clean(medication.dispenseRequest?.quantity?.value?.toString()) ?? "NA",
    unit: clean(medication.dispenseRequest?.quantity?.unit),
  };

  const quantityWithUnit =
    medicationRow.quantity + (medicationRow.unit ? `- ${medicationRow.unit}` : "");

  const rowAsString =
    `${medicationRow.date},` +
    `${medicationRow.status},` +
    `${medicationRow.medication.replaceAll(",", " -")},` +
    `${medicationRow.dosage.replaceAll(",", " -")},` +
    `${quantityWithUnit}\n`;
  return {
    toString: () => rowAsString,
    data: medicationRow,
  };
}

function createConsolidatedRow(patient: PatientDTO, medication: MedicationRequest): Row {
  const medicationRow = createMedicationRow(medication);
  const patientRow = {
    id: clean(patient.id),
    firstName: clean(patient.firstName),
    lastName: clean(patient.lastName),
    dob: clean(patient.dob),
    genderAtBirth: clean(patient.genderAtBirth),
    ...medicationRow.data,
  };

  const rowAsString =
    `${patientRow.id},` +
    `${patientRow.firstName},` +
    `${patientRow.lastName},` +
    `${patientRow.dob},` +
    `${patientRow.genderAtBirth},` +
    `${medicationRow.toString()}`;
  return {
    toString: () => rowAsString,
    data: patientRow,
  };
}

main();
