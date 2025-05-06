import { MedicationStatement } from "@medplum/fhirtypes";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";
import { FHIRResourceToString } from "../types";

/**
 * Converts a FHIR MedicationStatement resource to a string representation
 */
export class MedicationStatementToString implements FHIRResourceToString<MedicationStatement> {
  toString(statement: MedicationStatement): string | undefined {
    const parts: string[] = [];
    let hasRelevantData = false;

    // Add identifier
    const identifierStr = formatIdentifiers(statement.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (statement.status) {
      parts.push(`Status: ${statement.status}`);
    }

    // Add medication
    if (statement.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts(
        [statement.medicationCodeableConcept],
        "Medication"
      );
      if (medicationStr) {
        parts.push(medicationStr);
        hasRelevantData = true;
      }
    } else if (statement.medicationReference) {
      const medicationStr = formatReferences([statement.medicationReference], "Medication");
      if (medicationStr) {
        parts.push(medicationStr);
      }
    }

    // Add subject
    // if (statement.subject) {
    //   const subjectStr = formatReferences([statement.subject], "Subject");
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //   }
    // }

    // Add effective time
    if (statement.effectiveDateTime) {
      parts.push(`Effective: ${statement.effectiveDateTime}`);
    } else if (statement.effectivePeriod) {
      const effectiveStr = formatPeriod(statement.effectivePeriod, "Effective");
      if (effectiveStr) {
        parts.push(effectiveStr);
      }
    }

    // Add date asserted
    if (statement.dateAsserted) {
      parts.push(`Asserted: ${statement.dateAsserted}`);
    }

    // Add information source
    if (statement.informationSource) {
      const sourceStr = formatReferences([statement.informationSource], "Source");
      if (sourceStr) {
        parts.push(sourceStr);
      }
    }

    // Add derived from
    const derivedFromStr = formatReferences(statement.derivedFrom, "Derived From");
    if (derivedFromStr) {
      parts.push(derivedFromStr);
    }

    // Add reason
    const reasonStr = formatCodeableConcepts(statement.reasonCode, "Reason");
    if (reasonStr) {
      parts.push(reasonStr);
    }

    // Add note
    if (statement.note) {
      const notes = statement.note
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
