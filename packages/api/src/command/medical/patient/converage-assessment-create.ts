import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { Patient } from "@metriport/core/domain/patient";
import { sleep } from "@metriport/shared";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { createPatient, PatientCreateCmd } from "./create-patient";
import { matchPatient } from "./get-patient";
import { updatePatient } from "./update-patient";
import { getPatientOrFail } from "./get-patient";
import { queryDocumentsAcrossHIEs } from "../document/document-query";
import { getConsolidated, ConsolidatedData } from "./consolidated-get";

dayjs.extend(duration);

const delayTime = dayjs.duration(30, "seconds").asMilliseconds();
const dqDrBuffer = dayjs.duration(10, "minutes").asMilliseconds();

export async function createCoverageAssessments({
  cxId,
  facilityId,
  patientsCreates,
}: {
  cxId: string;
  facilityId: string;
  patientsCreates: PatientCreateCmd[];
}): Promise<void> {
  const patients: Patient[] = [];
  const pdChunkSize = 50;
  const pdChunks = chunk(patientsCreates, pdChunkSize);
  for (const chunk of pdChunks) {
    await sleep(delayTime);
    const createPatients: Promise<Patient>[] = [];
    for (const patient of chunk) {
      createPatients.push(createOrUpdatePatient(patient));
    }
    const patientsPromises = await Promise.allSettled(createPatients);
    patientsPromises.map(promise => {
      if (promise.status == "fulfilled") {
        patients.push(promise.value);
      }
    });
  }
  const patientIds = patients.map(patient => patient.id);
  const dqChunkSize = 10;
  const dQChunks = chunk(patientIds, dqChunkSize);
  for (const chunk of dQChunks) {
    await sleep(delayTime);
    const docQueries: Promise<DocumentQueryProgress>[] = [];
    for (const patientId of chunk) {
      docQueries.push(
        queryDocumentsAcrossHIEs({
          cxId,
          patientId,
          facilityId,
        })
      );
    }
    await Promise.allSettled(docQueries);
  }
  await sleep(dqDrBuffer);
  const pollingAttempts = 20;
  let remaininPatients = patients;
  for (let i = 0; i < pollingAttempts; i++) {
    await sleep(delayTime);
    const drDone: Promise<string | undefined>[] = [];
    for (const patient of patients) {
      drDone.push(pollDrDone(patient.id, cxId));
    }
    const drDonePromises = await Promise.allSettled(drDone);
    drDonePromises.map(promise => {
      if (promise.status == "fulfilled" && promise.value !== undefined) {
        remaininPatients = remaininPatients.filter(p => p.id !== promise.value);
      }
    });
    if (remaininPatients.length === 0) break;
  }
  const consolidatedChunkSize = 5;
  const consolidatedChunks = chunk(patients, consolidatedChunkSize);
  for (const chunk of consolidatedChunks) {
    await sleep(delayTime);
    const getConsolidateds: Promise<ConsolidatedData>[] = [];
    for (const patient of chunk) {
      getConsolidateds.push(getConsolidated({ patient, conversionType: "pdf" }));
    }
    await Promise.allSettled(getConsolidateds);
  }
}

async function createOrUpdatePatient(patient: PatientCreateCmd): Promise<Patient> {
  const matchedPatient = await matchPatient(patient);
  let updatedPatient: Patient;
  if (matchedPatient) {
    updatedPatient = await updatePatient({
      patientUpdate: {
        ...patient,
        id: matchedPatient.id,
      },
      rerunPdOnNewDemographics: true,
    });
  } else {
    updatedPatient = await createPatient({
      patient,
      rerunPdOnNewDemographics: true,
    });
  }
  return updatedPatient;
}

async function pollDrDone(id: string, cxId: string): Promise<string | undefined> {
  const patient = await getPatientOrFail({ id, cxId });
  if (patient?.data.documentQueryProgress?.convert?.status === "completed") {
    return id;
  }
  return undefined;
}
