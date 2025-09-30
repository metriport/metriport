import { isValidUuid } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { getCohortByNameSafe } from "./get-cohort";

/**
 * Returns the cohort with the specified name.
 * @param cxId The ID of the CX.
 * @param name The name of the cohort.
 * @returns The cohort with the specified name.
 */
export async function resolveCohortIdentifiersToUuids({
  cxId,
  identifiers,
}: {
  cxId: string;
  identifiers: string[];
}): Promise<string[]> {
  return await Promise.all(
    identifiers?.map(async cohortIdentifier => {
      if (isValidUuid(cohortIdentifier)) {
        return cohortIdentifier;
      }

      const cohort = await getCohortByNameSafe({ cxId, name: cohortIdentifier });
      if (cohort === undefined) {
        throw new BadRequestError(`Cohort not found with name ${cohortIdentifier}.`);
      }
      return cohort.id;
    }) ?? []
  );
}
