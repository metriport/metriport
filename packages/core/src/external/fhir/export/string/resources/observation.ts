import { Observation } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";

/**
 * Converts a FHIR Observation resource to a string representation
 */
export class ObservationToString implements FHIRResourceToString<Observation> {
  toString(observation: Observation): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(observation.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (observation.status) {
      parts.push(`Status: ${observation.status}`);
    }

    // Add category
    const categoryStr = formatCodeableConcepts(observation.category, "Category");
    if (categoryStr) {
      parts.push(categoryStr);
    }

    // Add code
    if (observation.code) {
      const codeStr = formatCodeableConcepts([observation.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
      }
    }

    // Add value
    if (observation.valueQuantity) {
      const valueStr = formatQuantity(observation.valueQuantity, "Value");
      if (valueStr) {
        parts.push(valueStr);
      }
    } else if (observation.valueCodeableConcept) {
      const valueStr = formatCodeableConcepts([observation.valueCodeableConcept], "Value");
      if (valueStr) {
        parts.push(valueStr);
      }
    }

    // Add effective time
    if (observation.effectiveDateTime) {
      parts.push(`Effective: ${observation.effectiveDateTime}`);
    }

    // Add issued
    if (observation.issued) {
      parts.push(`Issued: ${observation.issued}`);
    }

    // Add performer
    const performerStr = formatReferences(observation.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
