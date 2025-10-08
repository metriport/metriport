import { isValidUuid } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { normalizeCohortName } from "@metriport/core/command/patient-import/csv/convert-patient";
import { getCohortByNameSafe } from "./get-cohort";

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
  const results = await Promise.all(
    identifiers?.map(async cohortIdentifier => {
      const trimmed = cohortIdentifier.trim();
      if (isValidUuid(trimmed)) {
        return trimmed;
      }

      const cohort = await getCohortByNameSafe({
        cxId,
        name: normalizeCohortName(trimmed),
      });
      if (cohort === undefined) {
        throw new BadRequestError(`Cohort not found with identifier ${trimmed}.`);
      }
      return cohort.id;
    }) ?? []
  );
  return Array.from(new Set(results));
}
