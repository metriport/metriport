import { AllergyIntolerance } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR AllergyIntolerance resource to a string representation
 */
export class AllergyIntoleranceToString implements FHIRResourceToString<AllergyIntolerance> {
  toString(allergy: AllergyIntolerance): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers(allergy.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (allergy.clinicalStatus) {
      const statusStr = formatCodeableConcepts([allergy.clinicalStatus], "Clinical Status");
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    if (allergy.verificationStatus) {
      const statusStr = formatCodeableConcepts([allergy.verificationStatus], "Verification Status");
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    if (allergy.type) {
      parts.push(`Type: ${allergy.type}`);
      hasMinimumData = true;
    }

    if (allergy.category) {
      parts.push(`Category: ${allergy.category.join(FIELD_SEPARATOR)}`);
      hasMinimumData = true;
    }

    if (allergy.criticality) {
      parts.push(`Criticality: ${allergy.criticality}`);
    }

    if (allergy.code) {
      const codeStr = formatCodeableConcepts([allergy.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
        hasMinimumData = true;
      }
    }

    if (allergy.onsetDateTime) {
      parts.push(`Onset: ${allergy.onsetDateTime}`);
    }

    if (allergy.recordedDate) {
      parts.push(`Recorded: ${allergy.recordedDate}`);
    }

    if (allergy.recorder) {
      const recorderStr = formatReferences([allergy.recorder], "Recorder");
      if (recorderStr) {
        parts.push(recorderStr);
      }
    }

    if (allergy.asserter) {
      const asserterStr = formatReferences([allergy.asserter], "Asserter");
      if (asserterStr) {
        parts.push(asserterStr);
      }
    }

    if (allergy.lastOccurrence) {
      parts.push(`Last Occurrence: ${allergy.lastOccurrence}`);
    }

    const notes = formatAnnotations(allergy.note, "Note");
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
