import { Coverage } from "@medplum/fhirtypes";
import { isValidUuid } from "../../../../util/uuid-v7";

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
    return coverage;
  });
}
