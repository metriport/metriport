import { Location } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import { combineResources, fillMaps } from "../shared";

export function deduplicateLocations(locations: Location[]): {
  combinedLocations: Location[];
  refReplacementMap: Map<string, string[]>;
} {
  const { locationsMap, refReplacementMap } = groupSameLocations(locations);
  return {
    combinedLocations: combineResources({
      combinedMaps: [locationsMap],
    }),
    refReplacementMap,
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
} {
  const locationsMap = new Map<string, Location>();
  const refReplacementMap = new Map<string, string[]>();

  for (const location of locations) {
    const name = location.name;
    const address = location.address;

    if (name && address) {
      const normalizedAddress = normalizeAddress(address);
      const key = JSON.stringify({ name, address: normalizedAddress });
      fillMaps(locationsMap, key, location, refReplacementMap);
    }
  }

  return {
    locationsMap,
    refReplacementMap,
  };
}
