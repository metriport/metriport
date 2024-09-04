import { Practitioner } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import { DeduplicationResult, combineResources, createRef, extractNpi, fillMaps } from "../shared";

export function deduplicatePractitioners(
  practitioners: Practitioner[]
): DeduplicationResult<Practitioner> {
  const { practitionersMap, refReplacementMap, danglingReferences } =
    groupSamePractitioners(practitioners);
  return {
    combinedResources: combineResources({
      combinedMaps: [practitionersMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  danglingReferences: string[];
} {
  const practitionersMap = new Map<string, Practitioner>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  for (const practitioner of practitioners) {
    const npi = extractNpi(practitioner.identifier);
    const name = practitioner.name;
    const addresseses = practitioner.address;

    if (npi) {
      const key = JSON.stringify({ npi });
      fillMaps(practitionersMap, key, practitioner, refReplacementMap);
    } else if (name && addresseses) {
      const normalizedAddresses = addresseses.map(address => normalizeAddress(address));
      const key = JSON.stringify({ name, address: normalizedAddresses[0] });
      fillMaps(practitionersMap, key, practitioner, refReplacementMap);
    } else {
      danglingReferencesSet.add(createRef(practitioner));
    }
  }

  return {
    practitionersMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
