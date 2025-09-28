import { out } from "@metriport/core/util";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { uuidv7 } from "@metriport/shared/util";

export type AddPatientToCohortParams = {
  cohortId: string;
  cxId: string;
  patientId: string;
};

export async function addPatientToCohort({
  cohortId,
  cxId,
  patientId,
}: AddPatientToCohortParams): Promise<void> {
  const { log } = out(`addPatientToCohort - cx ${cxId}, cohort ${cohortId}, patient ${patientId}`);

  await PatientCohortModel.create({
    id: uuidv7(),
    patientId,
    cohortId,
  });

  log(`Added patient ${patientId} to cohort ${cohortId}`);
}
