import { Organization } from "@medplum/fhirtypes";
import { normalizeAddress } from "../../mpi/normalize-address";
import { combineResources, createRef, extractNpi, fillMaps } from "../shared";

export function deduplicateOrganizations(organizations: Organization[]): {
  combinedOrganizations: Organization[];
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const { organizationsMap, refReplacementMap, danglingReferences } =
    groupSameOrganizations(organizations);
  return {
    combinedOrganizations: combineResources({
      combinedMaps: [organizationsMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  danglingReferences: string[];
} {
  const organizationsMap = new Map<string, Organization>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  for (const organization of organizations) {
    const npi = extractNpi(organization.identifier);
    const name = organization.name;
    const addresses = organization.address;

    if (npi) {
      const key = JSON.stringify({ npi });
      fillMaps(organizationsMap, key, organization, refReplacementMap);
    } else if (name && addresses) {
      const normalizedAddresses = addresses.map(address => normalizeAddress(address));
      const key = JSON.stringify({ name, address: normalizedAddresses[0] });
      fillMaps(organizationsMap, key, organization, refReplacementMap);
    } else {
      danglingReferencesSet.add(createRef(organization));
    }
  }

  return {
    organizationsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
