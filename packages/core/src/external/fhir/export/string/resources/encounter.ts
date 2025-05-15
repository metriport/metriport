import { Encounter } from "@medplum/fhirtypes";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { checkDeny } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";
import { FHIRResourceToString } from "../types";

/**
 * Converts a FHIR Encounter resource to a string representation
 */
export class EncounterToString implements FHIRResourceToString<Encounter> {
  toString(encounter: Encounter): string | undefined {
    const parts: string[] = [];
    let hasRelevantData = false;
    // Add identifier
    const identifierStr = formatIdentifiers(encounter.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (encounter.status) {
      const status = checkDeny(encounter.status);
      if (status) {
        parts.push(`Status: ${status}`);
        hasRelevantData = true;
      }
    }

    // Add class
    if (encounter.class) {
      const codeStr = formatCodeableConcept(encounter.class);
      if (codeStr) {
        parts.push(`Class: ${codeStr}`);
        hasRelevantData = true;
      }
    }

    // Add type
    if (encounter.type) {
      const types = formatCodeableConcepts(encounter.type, "Type");
      if (types) {
        parts.push(types);
        hasRelevantData = true;
      }
    }

    // Add period
    if (encounter.period) {
      const start = encounter.period.start ?? "unknown";
      const end = encounter.period.end ?? "ongoing";
      parts.push(`Period: ${start} to ${end}`);
    }
    if (!hasRelevantData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
