import { Condition } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatReferences } from "../shared/reference";
import { formatPeriod } from "../shared/period";

/**
 * Converts a FHIR Condition resource to a string representation
 */
export class ConditionToString implements FHIRResourceToString<Condition> {
  toString(condition: Condition): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(condition.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add clinical status
    if (condition.clinicalStatus) {
      const statusStr = formatCodeableConcepts([condition.clinicalStatus], "Clinical Status");
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    // Add verification status
    if (condition.verificationStatus) {
      const statusStr = formatCodeableConcepts(
        [condition.verificationStatus],
        "Verification Status"
      );
      if (statusStr) {
        parts.push(statusStr);
      }
    }

    // Add category
    const categoryStr = formatCodeableConcepts(condition.category, "Category");
    if (categoryStr) {
      parts.push(categoryStr);
    }

    // Add code
    if (condition.code) {
      const codeStr = formatCodeableConcepts([condition.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
      }
    }

    // Add subject
    if (condition.subject) {
      const subjectStr = formatReferences([condition.subject], "Subject");
      if (subjectStr) {
        parts.push(subjectStr);
      }
    }

    // Add onset
    if (condition.onsetDateTime) {
      parts.push(`Onset: ${condition.onsetDateTime}`);
    } else if (condition.onsetPeriod) {
      const onsetStr = formatPeriod(condition.onsetPeriod, "Onset");
      if (onsetStr) {
        parts.push(onsetStr);
      }
    }

    // Add abatement
    if (condition.abatementDateTime) {
      parts.push(`Abatement: ${condition.abatementDateTime}`);
    } else if (condition.abatementPeriod) {
      const abatementStr = formatPeriod(condition.abatementPeriod, "Abatement");
      if (abatementStr) {
        parts.push(abatementStr);
      }
    }

    // Add recorder
    if (condition.recorder) {
      const recorderStr = formatReferences([condition.recorder], "Recorder");
      if (recorderStr) {
        parts.push(recorderStr);
      }
    }

    // Add asserter
    if (condition.asserter) {
      const asserterStr = formatReferences([condition.asserter], "Asserter");
      if (asserterStr) {
        parts.push(asserterStr);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
