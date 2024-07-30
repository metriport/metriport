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
import { getConsolidated, ConsolidatedData } from "./consolidated-get";

dayjs.extend(duration);

const delayTime = dayjs.duration(30, "seconds").asMilliseconds();
const dqDrMaxFinish = dayjs.duration(10, "minutes").asMilliseconds();

export type CoverageAssessment = {
  patientId: string;
  downloadStatus: string | undefined;
  docCount: number | undefined;
  convertStatus: string | undefined;
  fhirCount: number;
  fhirDetails: string;
  mrSummaryUrl: string | undefined;
};

export async function createCoverageAssessments({
  cxId,
  facilityId,
  patientsCreates,
}: {
  cxId: string;
  facilityId: string;
  patientsCreates: PatientCreateCmd[];
}): Promise<void> {
  const createOrUpdatePatient = async (patient: PatientCreateCmd): Promise<Patient> => {
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
  };

  const pdChunkSize = 50;
  const pdPatients: Patient[] = [];
  const pdChunks = chunk(patientsCreates, pdChunkSize);
  for (const chunk of pdChunks) {
    await sleep(delayTime);
    const createPatients: Promise<Patient>[] = [];
    for (const patient of chunk) {
      createPatients.push(createOrUpdatePatient(patient));
    }
    const patients = await Promise.allSettled(createPatients);
    patients.map(patient => {
      if (patient.status == "fulfilled") {
        pdPatients.push(patient.value);
      }
    });
  }
  const patientIds = pdPatients.map(p => p.id);
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
  await sleep(dqDrMaxFinish);
  const consolidatedChunks = chunk(pdPatients, dqChunkSize);
  for (const chunk of consolidatedChunks) {
    await sleep(delayTime);
    const getConsolidateds: Promise<ConsolidatedData>[] = [];
    for (const patient of chunk) {
      getConsolidateds.push(getConsolidated({ patient, conversionType: "pdf" }));
    }
    await Promise.allSettled(getConsolidateds);
  }
}
