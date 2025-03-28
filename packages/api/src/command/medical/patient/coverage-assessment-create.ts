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
import { queryDocumentsAcrossHIEs as singleQueryDocumentsAcrossHIEs } from "../document/document-query";

dayjs.extend(duration);

const delay = dayjs.duration(30, "seconds");

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
  const pdErrors: string[] = [];

  await executeAsynchronously(
    patientCreates.map(patientCreateCmd => {
      return { patientCreateCmd, patients, errors: pdErrors, log };
    }),
    createOrUpdatePatient,
    { numberOfParallelExecutions: 10, delay: delay.asMilliseconds() }
  );

  if (pdErrors.length > 0) {
    capture.error("Failed to create or update patient", {
      extra: {
        cxId,
        facilityId,
        patientCreateCount: patientCreates.length,
        errorCount: pdErrors.length,
        errors: pdErrors.join(","),
        context: "coverage-assessment.create",
      },
    });
  }

  const dqErrors: string[] = [];

  await executeAsynchronously(
    patients.map(patient => {
      return { cxId, patient, facilityId, errors: dqErrors, log };
    }),
    queryDocumentsAcrossHIEs,
    { numberOfParallelExecutions: 10, delay: delay.asMilliseconds() }
  );

  if (dqErrors.length > 0) {
    capture.error("Failed query docuemnts.", {
      extra: {
        cxId,
        facilityId,
        patientCount: patients.length,
        errorCount: dqErrors.length,
        errors: dqErrors.join(", "),
        context: "coverage-assessment.create",
      },
    });
  }
}

async function singleCreateOrUpdatePatient(patient: PatientCreateCmd): Promise<Patient> {
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

async function createOrUpdatePatient({
  patientCreateCmd,
  patients,
  errors,
  log,
}: {
  patientCreateCmd: PatientCreateCmd;
  patients: Patient[];
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const patient = await singleCreateOrUpdatePatient(patientCreateCmd);
    patients.push(patient);
  } catch (error) {
    const msg = `Failed to create or update patient. Cause: ${errorToString(error)}`;
    log(msg);
    errors.push(msg);
  }
}

async function queryDocumentsAcrossHIEs({
  cxId,
  patient,
  facilityId,
  errors,
  log,
}: {
  cxId: string;
  patient: Patient;
  facilityId: string;
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    await singleQueryDocumentsAcrossHIEs({
      cxId,
      patientId: patient.id,
      facilityId,
    });
  } catch (error) {
    const msg = `Failed query docuemnts. Patient: ${patient.id}. Cause: ${errorToString(error)}`;
    log(msg);
    errors.push(msg);
  }
}
