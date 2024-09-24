import { Location } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import {
  DeduplicationResult,
  createRef,
  createKeyFromObjects,
  createKeysFromObjectAndFlagBits,
  fillL1L2Maps,
} from "../shared";

export function deduplicateLocations(locations: Location[]): DeduplicationResult<Location> {
  const { locationsMap, refReplacementMap, danglingReferences } = groupSameLocations(locations);
  return {
    combinedResources: Array.from(locationsMap.values()),
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
  refReplacementMap: Map<string, string>;
  danglingReferences: string[];
} {
  const l1LocationsMap = new Map<string, string>();
  const l2LocationsMap = new Map<string, Location>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferencesSet = new Set<string>();

  for (const location of locations) {
    const name = location.name;
    const address = location.address;

    const addressBit = address ? 1 : 0;
    const nameBit = name ? 1 : 0;

    const setterKeys = [];
    const getterKeys = [];

    if (address && name) {
      const normalizedAddress = normalizeAddress(address);
      const key = createKeyFromObjects([name, normalizedAddress]);
      setterKeys.push(key);
      getterKeys.push(key);
    }

    if (name) {
      setterKeys.push(...createKeysFromObjectAndFlagBits({ name }, [addressBit]));
      if (addressBit === 0) {
        getterKeys.push(...createKeysFromObjectAndFlagBits({ name }, [1]));
        getterKeys.push(...createKeysFromObjectAndFlagBits({ name }, [0]));
      } else {
        getterKeys.push(...createKeysFromObjectAndFlagBits({ name }, [0]));
      }
    }

    if (address) {
      setterKeys.push(...createKeysFromObjectAndFlagBits({ address }, [nameBit]));
      if (nameBit === 0) {
        getterKeys.push(...createKeysFromObjectAndFlagBits({ address }, [1]));
        getterKeys.push(...createKeysFromObjectAndFlagBits({ address }, [0]));
      } else {
        getterKeys.push(...createKeysFromObjectAndFlagBits({ address }, [0]));
      }
    }

    if (setterKeys.length !== 0) {
      fillL1L2Maps({
        map1: l1LocationsMap,
        map2: l2LocationsMap,
        getterKeys,
        setterKeys,
        targetResource: location,
        refReplacementMap,
      });
    } else {
      // No name, no address
      danglingReferencesSet.add(createRef(location));
    }
  }

  return {
    locationsMap: l2LocationsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
