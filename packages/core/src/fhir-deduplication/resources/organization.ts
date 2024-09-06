import { Organization } from "@medplum/fhirtypes";
import { validateNPI } from "@metriport/shared";
import { normalizeAddress } from "../../mpi/normalize-address";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  extractNpi,
  fillL1L2Maps,
  createKeysArray,
  createKeys,
} from "../shared";

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
  // l1 points to l2
  const l1OrganizationsMap = new Map<string, string>();
  const l2OrganizationsMap = new Map<string, Organization>();

  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  for (const organization of organizations) {
    const npi = extractNpi(organization.identifier);
    const name = organization.name;
    const addresses = organization.address;

    // TODO ADD TELECOMS
    const hasNpi = npi && validateNPI(npi);
    const hasAddress = addresses && addresses.length > 0;
    const hasName = name && name.length > 0;

    const npiBit = hasNpi ? 1 : 0;
    const addressBit = hasAddress ? 1 : 0;

    const setterKeys = [];
    const getterKeys = [];

    // two orgs with the same npi are the same org, even if they have different addresses or names
    if (hasNpi) {
      const npiKey = JSON.stringify({ npi });
      setterKeys.push(npiKey);
      getterKeys.push(npiKey);
    }
    // two orgs with the same name and address are the same org, as long as their npis aren't different
    // bit slot zero is npi
    if (hasAddress && hasName) {
      const normalizedAddresses = addresses.map(address => normalizeAddress(address));
      setterKeys.push(...createKeysArray({ name }, normalizedAddresses, [npiBit]));
      if (npiBit === 0) {
        getterKeys.push(...createKeysArray({ name }, normalizedAddresses, [1]));
        getterKeys.push(...createKeysArray({ name }, normalizedAddresses, [0]));
      } else {
        getterKeys.push(...createKeysArray({ name }, normalizedAddresses, [0]));
      }
    }

    // two orgs with the same name are the same org, as long as their npis and addresses aren't different
    // bit slot zero is address, bit slot one is npi
    if (hasName) {
      const setterAddressKeys = createKeys({ name }, [addressBit, npiBit]);
      setterKeys.push(...setterAddressKeys);

      if (addressBit === 0 && npiBit === 0) {
        getterKeys.push(...createKeys({ name }, [1, 1]));
        getterKeys.push(...createKeys({ name }, [1, 0]));
        getterKeys.push(...createKeys({ name }, [0, 1]));
        getterKeys.push(...createKeys({ name }, [0, 0]));
      } else if (addressBit === 1 && npiBit === 0) {
        getterKeys.push(...createKeys({ name }, [0, 1]));
        getterKeys.push(...createKeys({ name }, [0, 0]));
      } else if (addressBit === 0 && npiBit === 1) {
        getterKeys.push(...createKeys({ name }, [1, 0]));
        getterKeys.push(...createKeys({ name }, [0, 0]));
      } else {
        getterKeys.push(...createKeys({ name }, [0, 0]));
      }
    }

    if (setterKeys.length != 0) {
      fillL1L2Maps({
        map1: l1OrganizationsMap,
        map2: l2OrganizationsMap,
        getterKeys,
        setterKeys,
        targetResource: organization,
        refReplacementMap,
      });
    } else {
      // no name, no npi
      danglingReferencesSet.add(createRef(organization));
    }
  }

  return {
    organizationsMap: l2OrganizationsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
