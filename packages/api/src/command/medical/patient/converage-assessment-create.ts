import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Patient } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
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
  const { log } = out(`createCoverageAssessments - cxId ${cxId}`);
  const patients: Patient[] = [];

  async function createOrUpdatePatientWrapper({
    patientCreateCmd,
    patients,
    log,
  }: {
    patientCreateCmd: PatientCreateCmd;
    patients: Patient[];
    log: typeof console.log;
  }): Promise<void> {
    try {
      const patient = await createOrUpdatePatient(patientCreateCmd);
      patients.push(patient);
    } catch (error) {
      const msg = `Failed to create or update patient. Cause: ${errorToString(error)}`;
      log(msg);
      capture.error(msg, {
        extra: {
          cxId,
          facilityId,
          context: "coverage-assessment.create",
        },
      });
    }
  }

  await executeAsynchronously(
    patientCreates.map(patientCreateCmd => {
      return { patientCreateCmd, patients, log };
    }),
    createOrUpdatePatientWrapper,
    {
      numberOfParallelExecutions: 50,
      minJitterMillis: delayTime.asMilliseconds(),
    }
  );

  async function queryDocumentsAcrossHIEsWrapper({
    cxId,
    patient,
    facilityId,
    log,
  }: {
    cxId: string;
    patient: Patient;
    facilityId: string;
    log: typeof console.log;
  }): Promise<void> {
    try {
      await queryDocumentsAcrossHIEs({
        cxId,
        patientId: patient.id,
        facilityId,
        triggerConsolidated: true,
      });
    } catch (error) {
      const msg = `Failed query docuemnts for patient ${patient.id}. Cause: ${errorToString(
        error
      )}`;
      log(msg);
      capture.error(msg, {
        extra: {
          cxId,
          facilityId,
          patientId: patient.id,
          context: "coverage-assessment.create",
        },
      });
    }
  }

  await executeAsynchronously(
    patients.map(patient => {
      return { cxId, patient, facilityId, log };
    }),
    queryDocumentsAcrossHIEsWrapper,
    {
      numberOfParallelExecutions: 10,
      minJitterMillis: delayTime.asMilliseconds(),
    }
  );
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
