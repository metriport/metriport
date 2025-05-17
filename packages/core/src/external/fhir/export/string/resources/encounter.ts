import { Encounter } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatCoding } from "../shared/coding";
import { emptyIfDenied } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Encounter resource to a string representation
 */
export class EncounterToString implements FHIRResourceToString<Encounter> {
  toString(encounter: Encounter): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers(encounter.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (encounter.status) {
      const status = emptyIfDenied(encounter.status);
      if (status) {
        parts.push(`Status: ${status}`);
        hasMinimumData = true;
      }
    }

    const codeStr = formatCoding(encounter.class);
    if (codeStr) {
      parts.push(`Class: ${codeStr}`);
      hasMinimumData = true;
    }

    if (encounter.type) {
      const types = formatCodeableConcepts(encounter.type, "Type");
      if (types) {
        parts.push(types);
        hasMinimumData = true;
      }
    }

    if (encounter.period) {
      const start = encounter.period.start ?? "unknown";
      const end = encounter.period.end ?? "ongoing";
      parts.push(`Period: ${start} to ${end}`);
    }
    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
