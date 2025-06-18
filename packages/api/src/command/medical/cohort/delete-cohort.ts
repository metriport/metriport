import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { CohortModel } from "../../../models/medical/cohort";
import { getCountOfPatientsAssignedToCohort } from "./patient-cohort/patient-cohort";

export async function deleteCohort({ id, cxId }: { id: string; cxId: string }): Promise<void> {
  const { log } = out(`deleteCohort - cx: ${cxId}, id: ${id}`);

  const count = await getCountOfPatientsAssignedToCohort({ cohortId: id });
  if (count > 0) {
    throw new BadRequestError("Unassign all patients before deleting the cohort.");
  }

  await CohortModel.destroy({ where: { id, cxId } });

  log(`Done.`);
  return;
}
