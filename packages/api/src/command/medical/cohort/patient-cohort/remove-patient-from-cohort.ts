import { out } from "@metriport/core/util";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export type RemovePatientFromCohortParams = {
  cohortId: string;
  cxId: string;
  patientId: string;
};

export async function removePatientFromCohort({
  cxId,
  cohortId,
  patientId,
}: RemovePatientFromCohortParams): Promise<void> {
  const { log } = out(
    `removePatientFromCohort - cx ${cxId}, cohort ${cohortId}, patient ${patientId}`
  );

  await PatientCohortModel.destroy({
    where: {
      cxId,
      cohortId,
      patientId,
    },
  });

  log(`Removed patient ${patientId} from cohort ${cohortId}`);
}
