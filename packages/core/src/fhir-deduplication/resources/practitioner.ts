import { Practitioner } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import { combineResources, fillMaps } from "../shared";

export function deduplicatePractitioners(practitioners: Practitioner[]): {
  combinedPractitioners: Practitioner[];
  refReplacementMap: Map<string, string[]>;
} {
  const { practitionersMap, refReplacementMap } = groupSamePractitioners(practitioners);
  return {
    combinedPractitioners: combineResources({
      combinedMaps: [practitionersMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - name // TODO: Fix the issue with multiple different doctor names on the same Practitioner resource on the FHIR converter prior to going into more depth here
 * - normalized address (1st entry in the array)
 */
export function groupSamePractitioners(practitioners: Practitioner[]): {
  practitionersMap: Map<string, Practitioner>;
  refReplacementMap: Map<string, string[]>;
} {
  const practitionersMap = new Map<string, Practitioner>();
  const refReplacementMap = new Map<string, string[]>();

  for (const practitioner of practitioners) {
    const name = practitioner.name;
    const addresseses = practitioner.address;

    if (name && addresseses) {
      const normalizedAddresses = addresseses.map(address => normalizeAddress(address));
      const key = JSON.stringify({ name, address: normalizedAddresses[0] });
      fillMaps(practitionersMap, key, practitioner, refReplacementMap);
    }
  }

  return {
    practitionersMap,
    refReplacementMap,
  };
}
