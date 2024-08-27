import { Organization } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import { combineResources, fillMaps } from "../shared";

export function deduplicateOrganizations(organizations: Organization[]): {
  combinedOrganizations: Organization[];
  refReplacementMap: Map<string, string[]>;
} {
  const { organizationsMap, refReplacementMap } = groupSameOrganizations(organizations);
  return {
    combinedOrganizations: combineResources({
      combinedMaps: [organizationsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - name
 * - normalized address (1st entry in the array)
 */
export function groupSameOrganizations(organizations: Organization[]): {
  organizationsMap: Map<string, Organization>;
  refReplacementMap: Map<string, string[]>;
} {
  const organizationsMap = new Map<string, Organization>();
  const refReplacementMap = new Map<string, string[]>();

  for (const organization of organizations) {
    const name = organization.name;
    const addresses = organization.address;

    if (name && addresses) {
      const normalizedAddresses = addresses.map(address => normalizeAddress(address));
      const key = JSON.stringify({ name, address: normalizedAddresses[0] });
      fillMaps(organizationsMap, key, organization, refReplacementMap);
    }
  }

  return {
    organizationsMap,
    refReplacementMap,
  };
}
