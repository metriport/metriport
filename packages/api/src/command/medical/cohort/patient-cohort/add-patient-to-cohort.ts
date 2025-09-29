import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/shared/util";
import { UniqueConstraintError } from "sequelize";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

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

  try {
    await PatientCohortModel.create({
      id: uuidv7(),
      cxId,
      patientId,
      cohortId,
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      log(`Patient already in cohort`);
      return;
    }
    log(`Error adding patient ${patientId} to cohort ${cohortId}: ${error}`);
    throw error;
  }

  log(`Added patient ${patientId} to cohort ${cohortId}`);
}
