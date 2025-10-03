import { out } from "@metriport/core/util";
import { CohortModel } from "../../../models/medical/cohort";
import { NotFoundError } from "@metriport/shared";

export async function deleteCohort({ id, cxId }: { id: string; cxId: string }): Promise<void> {
  const { log } = out(`deleteCohort - cx: ${cxId}, id: ${id}`);

  const result = await CohortModel.destroy({ where: { id, cxId } });

  if (result === 0) {
    throw new NotFoundError(`Could not find cohort`, undefined, { cxId, cohortId: id });
  }

  log(`Done.`);
}
