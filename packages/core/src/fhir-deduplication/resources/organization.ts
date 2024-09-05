import { Organization } from "@medplum/fhirtypes";
import { validateNPI } from "@metriport/shared";
import { normalizeAddress } from "../../mpi/normalize-address";
import { DeduplicationResult, combineResources, createRef, extractNpi, fillMaps } from "../shared";

export function deduplicateOrganizations(
  organizations: Organization[]
): DeduplicationResult<Organization> {
  const { organizationsMap, refReplacementMap, danglingReferences } =
    groupSameOrganizations(organizations);
  return {
    combinedResources: combineResources({
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

    if (npi && validateNPI(npi)) {
      const key = JSON.stringify({ npi });
      fillMaps(organizationsMap, key, organization, refReplacementMap);
    } else if (name && addresses) {
      const normalizedAddresses = addresses.map(address => normalizeAddress(address));
      const key = JSON.stringify({ name, address: normalizedAddresses[0] });
      fillMaps(organizationsMap, key, organization, refReplacementMap);
    } else if (name) {
      const key = JSON.stringify({ name });
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
