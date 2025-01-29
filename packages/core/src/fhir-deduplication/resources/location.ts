import { Location } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import {
  DeduplicationResult,
  buildKeyFromValueAndMissingDynamicAttribute,
  buildKeyFromValueAndMissingOptionalAttribute,
  buildKeyFromValueAndMissingRequiredAttribute,
  createKeyFromObjects,
  createRef,
  deduplicateAndTrackResource,
} from "../shared";

export function deduplicateLocations(locations: Location[]): DeduplicationResult<Location> {
  const { locationsMap, refReplacementMap, danglingReferences } = groupSameLocations(locations);
  return {
    combinedResources: Array.from(locationsMap.values()),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameLocations(locations: Location[]): {
  locationsMap: Map<string, Location>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const resourceKeyMap = new Map<string, string>();
  const dedupedResourcesMap = new Map<string, Location>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const location of locations) {
    const name = location.name;
    const address = location.address;

    const hasAddress = !!address;
    const hasName = !!name;

    const identifierKeys = [];
    const matchCandidateKeys = [];

    if (address && name) {
      const normalizedAddress = normalizeAddress(address);
      const key = createKeyFromObjects([name, normalizedAddress]);
      identifierKeys.push(key);
      matchCandidateKeys.push(key);
    }

    if (name) {
      identifierKeys.push(
        buildKeyFromValueAndMissingDynamicAttribute({ name }, "address", hasAddress)
      );
      if (hasAddress) {
        matchCandidateKeys.push(buildKeyFromValueAndMissingOptionalAttribute({ name }, "address"));
      } else {
        matchCandidateKeys.push(buildKeyFromValueAndMissingRequiredAttribute({ name }, "address"));
        matchCandidateKeys.push(buildKeyFromValueAndMissingOptionalAttribute({ name }, "address"));
      }
    }

    if (address) {
      identifierKeys.push(
        buildKeyFromValueAndMissingDynamicAttribute({ address }, "name", hasName)
      );
      if (hasName) {
        matchCandidateKeys.push(buildKeyFromValueAndMissingOptionalAttribute({ address }, "name"));
      } else {
        matchCandidateKeys.push(buildKeyFromValueAndMissingRequiredAttribute({ address }, "name"));
        matchCandidateKeys.push(buildKeyFromValueAndMissingOptionalAttribute({ address }, "name"));
      }
    }

    if (identifierKeys.length !== 0) {
      deduplicateAndTrackResource({
        resourceKeyMap,
        dedupedResourcesMap,
        identifierKeys,
        matchCandidateKeys,
        incomingResource: location,
        refReplacementMap,
      });
    } else {
      // No name, no address
      danglingReferences.add(createRef(location));
    }
  }

  return {
    locationsMap: dedupedResourcesMap,
    refReplacementMap,
    danglingReferences,
  };
}
