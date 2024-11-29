import { Coverage } from "@medplum/fhirtypes";
import { isValidUuid } from "../../../../util/uuid-v7";

/**
 * We want to remove useless identifiers that simply contain UUIDs from the CDA they came from.
 * Instead, we'd prefer to keep the identifiers that might hold policy ID, member ID, or subscriber ID.
 * @param coverages
 * @returns
 */
export function normalizeCoverages(coverages: Coverage[]): Coverage[] {
  return coverages.map(coverage => {
    const identifiers = coverage.identifier;
    if (!identifiers) return coverage;

    const validIdentifiers = identifiers.filter(identifier => {
      const value = identifier.value?.trim();
      if (!value) return false;

      if (value.includes("urn:uuid")) return false;
      const potentialUuid = value.split(":").pop()?.trim();
      if (isValidUuid(value) || (potentialUuid && isValidUuid(potentialUuid))) return false;

      return true;
    });
    coverage.identifier = validIdentifiers;
    coverage.subscriberId = validIdentifiers
      .flatMap(identifier => identifier.value || [])
      .join(", ");
    return coverage;
  });
}
