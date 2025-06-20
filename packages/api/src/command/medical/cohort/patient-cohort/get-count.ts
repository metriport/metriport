import { PatientCohortModel } from "../../../../models/medical/patient-cohort";

export async function getCountOfPatientsAssignedToCohort({
  cohortId,
  cxId,
}: {
  cohortId: string;
  cxId: string;
}): Promise<number> {
  return PatientCohortModel.count({
    where: { cohortId },
    include: [
      {
        association: PatientCohortModel.associations.Cohort,
        where: { cxId },
        attributes: [],
        required: true,
      },
    ],
  });
}
