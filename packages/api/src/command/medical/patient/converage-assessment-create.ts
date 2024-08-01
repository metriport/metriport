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

const delayTime = dayjs.duration(30, "seconds");
const dqDrBuffer = dayjs.duration(10, "minutes");

export async function createCoverageAssessments({
  cxId,
  facilityId,
  patientCreates,
}: {
  cxId: string;
  facilityId: string;
  patientCreates: PatientCreateCmd[];
}): Promise<void> {
  const patients: Patient[] = [];
  const pdChunkSize = 50;
  const pdChunks = chunk(patientCreates, pdChunkSize);
  for (const chunk of pdChunks) {
    await sleep(delayTime.asMilliseconds());
    const createPatients: Promise<Patient>[] = [];
    for (const patient of chunk) {
      createPatients.push(createOrUpdatePatient(patient));
    }
    const patientResults = await Promise.allSettled(createPatients);
    patientResults.map(result => {
      if (result.status == "fulfilled") patients.push(result.value);
    });
  }
  const patientIds = patients.map(patient => patient.id);
  const dqChunkSize = 10;
  const dQChunks = chunk(patientIds, dqChunkSize);
  for (const chunk of dQChunks) {
    await sleep(delayTime.asMilliseconds());
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
  await sleep(dqDrBuffer.asMilliseconds());
  const pollingAttempts = 20;
  const remainingPatientIds = [...patientIds];
  for (let i = 0; i < pollingAttempts; i++) {
    await sleep(delayTime.asMilliseconds());
    const drDone: Promise<string | undefined>[] = [];
    for (const patientId of patientIds) {
      drDone.push(pollDrDone(patientId, cxId));
    }
    const drDoneResults = await Promise.allSettled(drDone);
    drDoneResults.map(result => {
      if (result.status == "fulfilled" && result.value !== undefined) {
        const index = remainingPatientIds.indexOf(result.value);
        if (index > -1) remainingPatientIds.splice(index, 1);
      }
    });
    if (remainingPatientIds.length === 0) break;
  }
  const consolidatedChunkSize = 10;
  const consolidatedChunks = chunk(patients, consolidatedChunkSize);
  for (const chunk of consolidatedChunks) {
    await sleep(delayTime.asMilliseconds());
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
