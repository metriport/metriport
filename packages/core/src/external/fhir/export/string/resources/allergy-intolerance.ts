import { AllergyIntolerance } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatReference } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR AllergyIntolerance resource to a string representation
 */
export class AllergyIntoleranceToString implements FHIRResourceToString<AllergyIntolerance> {
  toString(allergy: AllergyIntolerance, isDebug?: boolean): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers({ identifiers: allergy.identifier });
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (allergy.clinicalStatus) {
      const statusStr = formatCodeableConcept({
        concept: allergy.clinicalStatus,
        label: "Clinical Status",
        isDebug,
      });
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    if (allergy.verificationStatus) {
      const statusStr = formatCodeableConcept({
        concept: allergy.verificationStatus,
        label: "Verification Status",
        isDebug,
      });
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    if (allergy.type) {
      parts.push(isDebug ? `Type: ${allergy.type}` : allergy.type);
      hasMinimumData = true;
    }

    if (allergy.category) {
      parts.push(
        isDebug
          ? `Category: ${allergy.category.join(FIELD_SEPARATOR)}`
          : allergy.category.join(FIELD_SEPARATOR)
      );
      hasMinimumData = true;
    }

    if (allergy.criticality) {
      parts.push(isDebug ? `Criticality: ${allergy.criticality}` : allergy.criticality);
    }

    if (allergy.code) {
      const codeStr = formatCodeableConcept({ concept: allergy.code, label: "Code", isDebug });
      if (codeStr) {
        parts.push(codeStr);
        hasMinimumData = true;
      }
    }

    if (allergy.onsetDateTime) {
      parts.push(isDebug ? `Onset: ${allergy.onsetDateTime}` : allergy.onsetDateTime);
    }

    if (allergy.recordedDate) {
      parts.push(isDebug ? `Recorded: ${allergy.recordedDate}` : allergy.recordedDate);
    }

    if (allergy.recorder) {
      const recorderStr = formatReference({
        reference: allergy.recorder,
        label: "Recorder",
        isDebug,
      });
      if (recorderStr) {
        parts.push(recorderStr);
      }
    }

    if (allergy.asserter) {
      const asserterStr = formatReference({
        reference: allergy.asserter,
        label: "Asserter",
        isDebug,
      });
      if (asserterStr) {
        parts.push(asserterStr);
      }
    }

    if (allergy.lastOccurrence) {
      parts.push(isDebug ? `Last Occurrence: ${allergy.lastOccurrence}` : allergy.lastOccurrence);
    }

    const notes = formatAnnotations({ annotations: allergy.note, label: "Note", isDebug });
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
