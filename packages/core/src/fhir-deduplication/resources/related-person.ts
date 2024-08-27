import { CodeableConcept, HumanName, RelatedPerson } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import { combineResources, fillMaps } from "../shared";

export function deduplicateRelatedPersons(relatedPersons: RelatedPerson[]): {
  combinedRelatedPersons: RelatedPerson[];
  refReplacementMap: Map<string, string[]>;
} {
  const { relatedPersonsMap, refReplacementMap } = groupSameRelatedPersons(relatedPersons);
  return {
    combinedRelatedPersons: combineResources({
      combinedMaps: [relatedPersonsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - relationship
 * - full name
 * - dob (optional)
 */
export function groupSameRelatedPersons(relatedPersons: RelatedPerson[]): {
  relatedPersonsMap: Map<string, RelatedPerson>;
  refReplacementMap: Map<string, string[]>;
} {
  const relatedPersonsMap = new Map<string, RelatedPerson>();
  const refReplacementMap = new Map<string, string[]>();

  for (const relatedPerson of relatedPersons) {
    const relationship = extractRelationship(relatedPerson.relationship);
    const name = extractName(relatedPerson.name);
    const dob = relatedPerson.birthDate;
    if (relationship && name) {
      const key = JSON.stringify({ relationship, name, dob });
      fillMaps(relatedPersonsMap, key, relatedPerson, refReplacementMap);
    }
  }

  return {
    relatedPersonsMap,
    refReplacementMap,
  };
}

function extractRelationship(concepts: CodeableConcept[] | undefined): string | undefined {
  if (!concepts) return undefined;

  for (const concept of concepts) {
    if (concept.coding) {
      for (const coding of concept.coding) {
        const system = coding.system?.toLowerCase();
        const code = coding.code?.trim().toLowerCase();
        const display = coding.display?.trim().toLowerCase();
        if (system && display) {
          if (display !== "unknown") return display;
          if (code !== "unk") return code;
        }
      }
    }
  }
  return undefined;
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
