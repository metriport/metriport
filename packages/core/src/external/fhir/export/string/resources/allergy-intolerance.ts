import { AllergyIntolerance } from "@medplum/fhirtypes";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";
import { FHIRResourceToString } from "../types";

/**
 * Converts a FHIR AllergyIntolerance resource to a string representation
 */
export class AllergyIntoleranceToString implements FHIRResourceToString<AllergyIntolerance> {
  toString(allergy: AllergyIntolerance): string | undefined {
    const parts: string[] = [];
    let hasRelevantData = false;

    // Add identifier
    const identifierStr = formatIdentifiers(allergy.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add clinical status
    if (allergy.clinicalStatus) {
      const statusStr = formatCodeableConcepts([allergy.clinicalStatus], "Clinical Status");
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    // Add verification status
    if (allergy.verificationStatus) {
      const statusStr = formatCodeableConcepts([allergy.verificationStatus], "Verification Status");
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    // Add type
    if (allergy.type) {
      parts.push(`Type: ${allergy.type}`);
      hasRelevantData = true;
    }

    // Add category
    if (allergy.category) {
      parts.push(`Category: ${allergy.category.join(", ")}`);
      hasRelevantData = true;
    }

    // Add criticality
    if (allergy.criticality) {
      parts.push(`Criticality: ${allergy.criticality}`);
    }

    // Add code
    if (allergy.code) {
      const codeStr = formatCodeableConcepts([allergy.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
        hasRelevantData = true;
      }
    }

    // Add onset
    if (allergy.onsetDateTime) {
      parts.push(`Onset: ${allergy.onsetDateTime}`);
    }

    // Add recorded date
    if (allergy.recordedDate) {
      parts.push(`Recorded: ${allergy.recordedDate}`);
    }

    // Add recorder
    if (allergy.recorder) {
      const recorderStr = formatReferences([allergy.recorder], "Recorder");
      if (recorderStr) {
        parts.push(recorderStr);
      }
    }

    // Add asserter
    if (allergy.asserter) {
      const asserterStr = formatReferences([allergy.asserter], "Asserter");
      if (asserterStr) {
        parts.push(asserterStr);
      }
    }

    // Add last occurrence
    if (allergy.lastOccurrence) {
      parts.push(`Last Occurrence: ${allergy.lastOccurrence}`);
    }

    // Add note
    if (allergy.note) {
      const notes = allergy.note
        .map(note => note.text)
        .filter(Boolean)
        .join(FIELD_SEPARATOR);
      if (notes) {
        parts.push(`Note: ${notes}`);
        hasRelevantData = true;
      }
    }

    if (!hasRelevantData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
