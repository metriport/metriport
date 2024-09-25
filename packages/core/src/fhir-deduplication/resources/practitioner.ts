import { Practitioner } from "@medplum/fhirtypes";
import { validateNPI } from "@metriport/shared";
import { normalizeAddress } from "../../mpi/normalize-address";
import {
  DeduplicationResult,
  createRef,
  extractNpi,
  fillL1L2Maps,
  createKeysFromObjectArrayAndFlagBits,
  createKeysFromObjectAndFlagBits,
} from "../shared";

export function deduplicatePractitioners(
  practitioners: Practitioner[]
): DeduplicationResult<Practitioner> {
  const { practitionersMap, refReplacementMap, danglingReferences } =
    groupSamePractitioners(practitioners);
  return {
    combinedResources: Array.from(practitionersMap.values()),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSamePractitioners(practitioners: Practitioner[]): {
  practitionersMap: Map<string, Practitioner>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1PractitionersMap = new Map<string, string>();
  const l2PractitionersMap = new Map<string, Practitioner>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const practitioner of practitioners) {
    const npi = extractNpi(practitioner.identifier);
    const name = practitioner.name?.[0]; // Assuming we use the first name in the array
    const addresses = practitioner.address;
    const telecom = practitioner.telecom;

    const hasNpi = npi && validateNPI(npi);
    const hasAddress = addresses && addresses.length > 0;
    const hasName = name && Object.keys(name).length > 0;
    const hasTelecom = practitioner.telecom && practitioner.telecom.length > 0;

    const npiBit = hasNpi ? 1 : 0;
    const addressBit = hasAddress ? 1 : 0;
    const nameBit = hasName ? 1 : 0;

    const setterKeys = [];
    const getterKeys = [];

    // Two practitioners with the same NPI are the same, even if they have different addresses or names
    if (hasNpi) {
      const npiKey = JSON.stringify({ npi });
      setterKeys.push(npiKey);
      getterKeys.push(npiKey);
    }

    // Two practitioners with the same name and address are the same, as long as their NPIs aren't different
    if (hasAddress && hasName) {
      const normalizedAddresses = addresses.map(address => normalizeAddress(address));
      setterKeys.push(...createKeysFromObjectArrayAndFlagBits(name, normalizedAddresses, [npiBit]));
      if (npiBit === 0) {
        getterKeys.push(...createKeysFromObjectArrayAndFlagBits(name, normalizedAddresses, [1]));
        getterKeys.push(...createKeysFromObjectArrayAndFlagBits(name, normalizedAddresses, [0]));
      } else {
        getterKeys.push(...createKeysFromObjectArrayAndFlagBits(name, normalizedAddresses, [0]));
      }
    }

    if (hasAddress && hasTelecom) {
      const normalizedAddresses = addresses.map(address => normalizeAddress(address));
      setterKeys.push(
        ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [npiBit, nameBit])
      );
      if (npiBit === 0 && nameBit === 0) {
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [1, 1])
        );
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [1, 0])
        );
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [0, 1])
        );
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [0, 0])
        );
      } else if (npiBit === 1 && nameBit === 0) {
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [0, 1])
        );
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [0, 0])
        );
      } else if (npiBit === 0 && nameBit === 1) {
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [1, 0])
        );
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [0, 0])
        );
      } else {
        getterKeys.push(
          ...createKeysFromObjectArrayAndFlagBits({ telecom }, normalizedAddresses, [0, 0])
        );
      }
    }
    // Two practitioners with the same name are the same, as long as their NPIs and addresses aren't different
    if (hasName) {
      const setterNameKeys = createKeysFromObjectAndFlagBits(name, [addressBit, npiBit]);
      setterKeys.push(...setterNameKeys);

      if (addressBit === 0 && npiBit === 0) {
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [1, 1]));
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [1, 0]));
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [0, 1]));
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [0, 0]));
      } else if (addressBit === 1 && npiBit === 0) {
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [0, 1]));
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [0, 0]));
      } else if (addressBit === 0 && npiBit === 1) {
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [1, 0]));
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [0, 0]));
      } else {
        getterKeys.push(...createKeysFromObjectAndFlagBits(name, [0, 0]));
      }
    }

    if (setterKeys.length !== 0) {
      fillL1L2Maps({
        map1: l1PractitionersMap,
        map2: l2PractitionersMap,
        getterKeys,
        setterKeys,
        targetResource: practitioner,
        refReplacementMap,
      });
    } else {
      // No name, no NPI
      danglingReferences.add(createRef(practitioner));
    }
  }

  return {
    practitionersMap: l2PractitionersMap,
    refReplacementMap,
    danglingReferences,
  };
}
