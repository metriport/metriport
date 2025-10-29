import { out } from "@metriport/core/util";
import { CohortModel } from "../../../models/medical/cohort";
import { BadRequestError, MetriportError } from "@metriport/shared";
import { getPatientIdsInCohort } from "./utils";

export async function deleteCohort({ id, cxId }: { id: string; cxId: string }): Promise<void> {
  const { log } = out(`deleteCohort - cx: ${cxId}, id: ${id}`);

  const patientIds = await getPatientIdsInCohort({ cohortId: id, cxId });

  if (patientIds.length > 0) {
    throw new BadRequestError("Cannot delete cohort with patients", undefined, {
      cohortId: id,
      patientCount: patientIds.length,
    });
  }

  const deletedCount = await CohortModel.destroy({ where: { id, cxId } });

  if (deletedCount === 0) {
    throw new MetriportError(`Could not find cohort`, undefined, { cohortId: id });
  }

  log(`Done.`);
}
