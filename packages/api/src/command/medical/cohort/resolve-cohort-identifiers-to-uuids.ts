import { isValidUuid } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { getCohortModelOrFail } from "./get-cohort";

/**
 * Takes a list of cohort identifiers (can be names or ids) and returns a list of unique cohort ids.
 *
 * @param cxId The ID of the CX.
 * @param identifiers The list of cohort identifiers (can be names or ids).
 * @returns The list of cohort ids.
 */
export async function resolveCohortIdentifiersToUuids({
  cxId,
  identifiers,
}: {
  cxId: string;
  identifiers: string[];
}): Promise<string[]> {
  if (!identifiers || identifiers.length === 0) {
    return [];
  }

  const results = await Promise.all(
    identifiers.map(async cohortIdentifier => {
      const trimmed = cohortIdentifier.trim();

      if (!isValidUuid(trimmed)) {
        throw new BadRequestError(`Cohort not found with identifier ${trimmed}.`);
      }

      const cohort = await getCohortModelOrFail({ cxId, id: trimmed });
      return cohort.dataValues.id;
    })
  );

  const uniqueResults = Array.from(new Set(results));
  return uniqueResults;
}
