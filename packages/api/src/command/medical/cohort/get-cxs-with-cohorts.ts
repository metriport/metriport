import { CohortModel } from "../../../models/medical/cohort";

/**
 * Returns all unique cxIds that have at least one cohort.
 *
 * @returns Array of unique cxIds that have cohorts.
 */
export async function getCxsWithCohorts(): Promise<string[]> {
  const cohorts = await CohortModel.findAll({
    attributes: ["cxId"],
    group: ["cxId"],
    order: [["cxId", "ASC"]],
  });

  return cohorts.map(c => c.dataValues.cxId);
}
