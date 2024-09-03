import { Location } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import { combineResources, createRef, fillMaps } from "../shared";

export function deduplicateLocations(locations: Location[]): {
  combinedLocations: Location[];
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const { locationsMap, refReplacementMap, danglingReferences } = groupSameLocations(locations);
  return {
    combinedLocations: combineResources({
      combinedMaps: [locationsMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - name
 * - normalized address
 */
export function groupSameLocations(locations: Location[]): {
  locationsMap: Map<string, Location>;
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const locationsMap = new Map<string, Location>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  for (const location of locations) {
    const name = location.name;
    const address = location.address;

    if (name && address) {
      const normalizedAddress = normalizeAddress(address);
      const key = JSON.stringify({ name, address: normalizedAddress });
      fillMaps(locationsMap, key, location, refReplacementMap);
    } else {
      danglingReferencesSet.add(createRef(location));
    }
  }

  return {
    locationsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
