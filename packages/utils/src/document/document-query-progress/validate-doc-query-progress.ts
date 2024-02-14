import * as dotenv from "dotenv";
dotenv.config();

import { PatientDTO, USState, MetriportMedicalApi, FacilityCreate } from "@metriport/api-sdk";
import { sleep, executeWithRetries } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { faker } from "@faker-js/faker";
import duration from "dayjs/plugin/duration";
import dayjs from "dayjs";
import axios from "axios";
import { patientsToCreate } from "./patients";
dayjs.extend(duration);

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const DOCUMENT_QUERY_COUNT_TIMEOUT = dayjs.duration({ minutes: 120 });
const CHECK_COUNT_INTERVAL = dayjs.duration({ minutes: 1 });
const CREATE_PATIENT_SLEEP = dayjs.duration({ minutes: 1 });

export const internalApi = axios.create({
  baseURL: apiUrl,
  headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
});

const metriportApi = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

/**
 * Facility to create the patients under.
 */
const createFacility: FacilityCreate = {
  name: faker.word.noun(),
  npi: "2974324529",
  active: true,
  address: {
    addressLine1: faker.location.streetAddress(),
    city: faker.location.city(),
    state: USState.CA,
    zip: faker.location.zipCode("#####"),
    country: "USA",
  },
};

/**
 * This is to test that the count works after the doc query is complete and subsequent doc query is performed.
 */
const resetAndRunAgain = false;

/**
 * Utility to test doc query progress for a given set of patients.
 *
 * This will:
 *    - create a new facility
 *    - create a new patient for each patient in `patientsToCreate`
 *    - check if the patient is linked
 *    - start a doc query for each patient
 *    - check the doc query progress for each patient
 *    - log the result of all the doc queries
 *    - delete the patient after the doc query is complete
 *
 *
 * Update the respective env variables and run `ts-node validate-doc-query-progress.ts`
 *
 * Note: You can use the populate-patients.ts script to populate
 * the patients with documents you wish to query here which should be the same as
 * the ones seen in ./patients.
 */

async function main() {
  const facility = await metriportApi.createFacility(createFacility);

  const createdPatients: PatientDTO[] = [];

  for (const patientToCreate of patientsToCreate) {
    const patient = await metriportApi.createPatient(patientToCreate, facility.id);

    console.log("Patient created:", patient.id, patient.firstName, patient.lastName);

    createdPatients.push(patient);
  }

  await validateDocQueryProgress(createdPatients, facility.id);

  if (resetAndRunAgain) {
    await validateDocQueryProgress(createdPatients, facility.id, true);
  }

  for (const patient of createdPatients) {
    await internalApi.delete(
      `/internal/patient/${patient.id}?facilityId=${facility.id}&cxId=${cxId}`
    );
  }
}

const validateDocQueryProgress = async (
  createdPatients: PatientDTO[],
  facilityId: string,
  resetAndRunAgain = false
): Promise<void> => {
  const promises = createdPatients.map(async patient => {
    const isPatientLinked = await checkPatientLinkingStatus(patient, facilityId);

    console.log(`isPatientLinked: ${patient.firstName} ${patient.lastName}`, isPatientLinked);

    if (isPatientLinked) {
      return await queryPatientDocs(patient, facilityId, resetAndRunAgain);
    }

    return { patient, successful: false };
  });

  const resultPromises = await Promise.allSettled(promises);

  const fulfilled = resultPromises.flatMap(p => (p.status === "fulfilled" ? p.value : []));

  console.log("Patient statuses:", JSON.stringify(fulfilled, null, 2));

  const successfulPatientQueries = fulfilled.filter(p => p.successful);

  const overallSuccess = successfulPatientQueries.length === createdPatients.length;

  console.log(
    `The doc query was completed for all patients${
      resetAndRunAgain ? " (resetAndRunAgain)" : ""
    } - status were all queries successful:`,
    overallSuccess
  );
};

async function checkPatientLinkingStatus(
  patient: PatientDTO,
  facilityId: string
): Promise<boolean> {
  let isPatientLinked = await checkPatientLinked(patient, facilityId);

  while (!isPatientLinked) {
    await sleep(CREATE_PATIENT_SLEEP.asMilliseconds());

    const retryIsPatientLinked = await executeWithRetries(
      () => checkPatientLinked(patient, facilityId),
      3,
      500
    );

    if (retryIsPatientLinked) {
      isPatientLinked = true;
      break;
    } else if (retryIsPatientLinked === undefined) {
      isPatientLinked = false;
      break;
    }

    console.log("Retrying checkPatientLinked");
  }

  return isPatientLinked;
}

async function checkPatientLinked(patient: PatientDTO, facilityId: string) {
  const patientLinks = await internalApi.get(
    `/internal/patient/${patient.id}/link?facilityId=${facilityId}&cxId=${cxId}`
  );

  return patientLinks.data.currentLinks.length > 0;
}

type RaceControl = { isRaceInProgress: boolean };

const metadata = {
  disableWHFlag: "true",
};

async function queryPatientDocs(
  patient: PatientDTO,
  facilityId: string,
  resetAndRunAgain = false
): Promise<{ patient: PatientDTO; successful: boolean }> {
  try {
    if (resetAndRunAgain) {
      await internalApi.post(
        `/medical/v1/document/query`,
        {
          metadata,
        },
        {
          params: {
            patientId: patient.id,
            facilityId,
            override: true,
          },
        }
      );
    } else {
      await metriportApi.startDocumentQuery(patient.id, facilityId, metadata);
    }

    console.log("Document query started:", patient.id, patient.firstName, patient.lastName);

    const raceControl: RaceControl = { isRaceInProgress: true };

    const raceResult = await Promise.race([
      controlDuration(),
      checkQueryCount(raceControl, patient),
    ]);

    if (raceResult !== undefined && raceResult.successful) {
      raceControl.isRaceInProgress = false;

      return { patient, successful: true };
    }

    return { patient, successful: false };
  } catch (err) {
    console.log("ERROR:", err);
    return { patient, successful: false };
  }
}

async function controlDuration(): Promise<{ msg: string; successful: boolean }> {
  const timeout = DOCUMENT_QUERY_COUNT_TIMEOUT.asMilliseconds();
  await sleep(timeout);
  return { msg: `Document Query Count reached timeout after ${timeout} ms`, successful: false };
}

async function checkQueryCount(
  raceControl: RaceControl,
  patient: PatientDTO
): Promise<{ msg: string; successful: boolean } | undefined> {
  while (raceControl.isRaceInProgress) {
    const queryStatus = await metriportApi.getDocumentQueryStatus(patient.id);

    const { download, convert } = queryStatus;

    console.log(
      `Document Query Status name ${patient.firstName} patientId ${patient.id}:`,
      queryStatus
    );

    const isComplete = download?.status === "completed" && convert?.status === "completed";

    if (isComplete) {
      const msg = `Document query count completed. Name ${patient.firstName}`;
      raceControl.isRaceInProgress = false;
      console.log(msg);
      return { msg, successful: true };
    }

    await sleep(CHECK_COUNT_INTERVAL.asMilliseconds());
  }
}

main();
