import { HumanName, RelatedPerson } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import {
  DeduplicationResult,
  createRef,
  createKeysFromObjectAndFlagBits,
  createKeysFromObjectArrayAndFlagBits,
  fillL1L2Maps,
  createKeyFromObjects,
} from "../shared";
import { normalizeAddress } from "../../mpi/normalize-address";

export function deduplicateRelatedPersons(
  relatedPersons: RelatedPerson[]
): DeduplicationResult<RelatedPerson> {
  const { relatedPersonsMap, refReplacementMap, danglingReferences } =
    groupSameRelatedPersons(relatedPersons);
  return {
    combinedResources: Array.from(relatedPersonsMap.values()),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameRelatedPersons(relatedPersons: RelatedPerson[]): {
  relatedPersonsMap: Map<string, RelatedPerson>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1RelatedPersonsMap = new Map<string, string>();
  const l2RelatedPersonsMap = new Map<string, RelatedPerson>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const relatedPerson of relatedPersons) {
    const name = extractName(relatedPerson.name);
    const dob = relatedPerson.birthDate;
    const addresses = relatedPerson.address;
    const relationship = relatedPerson.relationship;

    const hasAddress = addresses && addresses.length > 0;
    const hasRelationship = relationship && relationship.length > 0;

    const nameBit = name ? 1 : 0;
    const addressBit = hasAddress ? 1 : 0;

    const setterKeys = [];
    const getterKeys = [];

    if (hasRelationship) {
      // name + rel
      if (name) {
        const nameRelKey = createKeyFromObjects([name, relationship]);
        setterKeys.push(nameRelKey);
        getterKeys.push(nameRelKey);
      }

      // addr + rel and no name
      if (hasAddress) {
        const normalizedAddresses = addresses.map(address => normalizeAddress(address));
        const addrRelKeys = createKeysFromObjectArrayAndFlagBits(
          relationship,
          normalizedAddresses,
          [nameBit]
        );
        setterKeys.push(...addrRelKeys);
        if (nameBit === 0) {
          getterKeys.push(
            ...createKeysFromObjectArrayAndFlagBits(relationship, normalizedAddresses, [1])
          );
          getterKeys.push(
            ...createKeysFromObjectArrayAndFlagBits(relationship, normalizedAddresses, [0])
          );
        } else {
          getterKeys.push(
            ...createKeysFromObjectArrayAndFlagBits(relationship, normalizedAddresses, [0])
          );
        }
      }

      // dob + rel and no name or addr
      if (dob) {
        const dobRelKeys = createKeysFromObjectAndFlagBits({ dob, relationship }, [
          nameBit,
          addressBit,
        ]);
        setterKeys.push(...dobRelKeys);
        if (nameBit === 0 && addressBit === 0) {
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [1, 1]));
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [1, 0]));
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [0, 1]));
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [0, 0]));
        } else if (nameBit === 1 && addressBit === 0) {
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [0, 1]));
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [0, 0]));
        } else if (nameBit === 0 && addressBit === 1) {
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [1, 0]));
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [0, 0]));
        } else {
          getterKeys.push(...createKeysFromObjectAndFlagBits({ dob, relationship }, [0, 0]));
        }
      }
    }

    if (setterKeys.length !== 0) {
      fillL1L2Maps({
        map1: l1RelatedPersonsMap,
        map2: l2RelatedPersonsMap,
        getterKeys,
        setterKeys,
        targetResource: relatedPerson,
        refReplacementMap,
      });
    } else {
      // No relationship or no other identifying information
      danglingReferences.add(createRef(relatedPerson));
    }
  }

  return {
    relatedPersonsMap: l2RelatedPersonsMap,
    refReplacementMap,
    danglingReferences,
  };
}

function extractName(names: HumanName[] | undefined): string | undefined {
  if (!names) return undefined;
  for (const name of names) {
    const first = name.given?.join(" ").trim();
    const last = name.family?.trim();
    const text = name.text?.trim();

    if (first && last) return toTitleCase(`${first} ${last}`);
    if (text) return toTitleCase(text);
  }
  return undefined;
}
