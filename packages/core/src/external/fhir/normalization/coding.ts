import { Bundle, CodeableConcept, Coding, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import {
  CPT_URL,
  CVX_URL,
  ICD_10_URL,
  ICD_9_URL,
  LOINC_URL,
  NDC_URL,
  RXNORM_URL,
  SNOMED_URL,
} from "../../../util/constants";
import { isCodeableConcept, isUsefulDisplay, isValidCoding } from "../codeable-concept";

export function sortCodings(bundle: Bundle<Resource>): Bundle<Resource> {
  const updatedBundle = cloneDeep(bundle);
  updatedBundle.entry?.forEach(entry => {
    if (entry.resource) {
      normalizeResource(entry.resource);
    }
  });

  return updatedBundle;
}

function normalizeResource(resource: Resource): void {
  for (const [key, value] of Object.entries(resource)) {
    if (!value) continue;

    if (isCodeableConcept(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (resource as any)[key] = normalizeCodeableConcept(value);
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (isCodeableConcept(item)) {
          value[idx] = normalizeCodeableConcept(item);
        }
      });
    }
  }
}

export function normalizeCodeableConcept(concept: CodeableConcept): CodeableConcept {
  if (!concept.coding) return concept;
  const codings = concept.coding;
  const filteredCodings = codings.length > 1 ? codings.filter(isValidCoding) : codings;
  const sortedCodings = [...filteredCodings].sort((a, b) => rankCoding(a) - rankCoding(b));
  const replacementText = sortedCodings.find(c => c.display && isUsefulDisplay(c.display))?.display;

  return {
    ...concept,
    ...(replacementText && isUsefulDisplay(replacementText)
      ? { text: replacementText }
      : undefined),
    coding: sortedCodings,
  };
}

// TODO: 2626 - Improve sorting for codes from the same system
function rankCoding(coding: Coding): number {
  const system = coding.system;
  if (!system) return 99;

  switch (system) {
    case RXNORM_URL:
      return 1;
    case NDC_URL:
      return 2;
    case CPT_URL:
      return 1;
    case CVX_URL:
      return 1;
    case ICD_10_URL:
      return 1;
    case ICD_9_URL:
      return 2;
    case LOINC_URL:
      return 3;
    case SNOMED_URL:
      return 4;
    default:
      return 99;
  }
}
