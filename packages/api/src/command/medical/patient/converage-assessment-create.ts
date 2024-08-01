import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { chunk } from "lodash";
import { Patient } from "@metriport/core/domain/patient";
import { sleep } from "@metriport/shared";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { createPatient, PatientCreateCmd } from "./create-patient";
import { matchPatient } from "./get-patient";
import { updatePatient } from "./update-patient";
import { queryDocumentsAcrossHIEs } from "../document/document-query";

dayjs.extend(duration);

const delayTime = dayjs.duration(30, "seconds");

export async function createCoverageAssessments({
  cxId,
  facilityId,
  patientCreates,
}: {
  cxId: string;
  facilityId: string;
  patientCreates: PatientCreateCmd[];
}): Promise<void> {
  const chunkSize = 50;
  const patients: Patient[] = [];

  const pdChunks = chunk(patientCreates, chunkSize);
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

  const dQChunks = chunk(patients, chunkSize);
  for (const chunk of dQChunks) {
    await sleep(delayTime.asMilliseconds());
    const docQueries: Promise<DocumentQueryProgress>[] = [];
    for (const patient of chunk) {
      docQueries.push(
        queryDocumentsAcrossHIEs({
          cxId,
          patientId: patient.id,
          facilityId,
          triggerConsolidated: true,
        })
      );
    }
    await Promise.allSettled(docQueries);
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
