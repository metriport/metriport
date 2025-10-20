import { MedicationStatement } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatDosages } from "../shared/dosage";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationStatement resource to a string representation
 */
export class MedicationStatementToString implements FHIRResourceToString<MedicationStatement> {
  toString(statement: MedicationStatement, isDebug?: boolean): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers({ identifiers: statement.identifier });
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (statement.status) {
      parts.push(isDebug ? `Status: ${statement.status}` : statement.status);
    }

    const statusReasonStr = formatCodeableConcepts({
      concepts: statement.statusReason,
      label: "Status Reason",
      isDebug,
    });
    if (statusReasonStr) parts.push(statusReasonStr);

    const categoryStr = formatCodeableConcept({
      concept: statement.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    if (statement.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts({
        concepts: [statement.medicationCodeableConcept],
        label: "Medication",
        isDebug,
      });
      if (medicationStr) {
        parts.push(medicationStr);
        hasMinimumData = true;
      }
    }

    if (statement.medicationReference) {
      const medicationStr = formatReferences({
        references: [statement.medicationReference],
        label: "Medication",
        isDebug,
      });
      if (medicationStr) {
        parts.push(medicationStr);
      }
    }

    // if (statement.subject) {
    //   const subjectStr = formatReferences([statement.subject], "Subject");
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //   }
    // }

    if (statement.effectiveDateTime) {
      parts.push(
        isDebug ? `Effective: ${statement.effectiveDateTime}` : statement.effectiveDateTime
      );
    }

    if (statement.effectivePeriod) {
      const effectiveStr = formatPeriod({
        period: statement.effectivePeriod,
        label: "Effective",
        isDebug,
      });
      if (effectiveStr) parts.push(effectiveStr);
    }

    if (statement.dateAsserted) {
      parts.push(isDebug ? `Asserted: ${statement.dateAsserted}` : statement.dateAsserted);
    }

    if (statement.informationSource) {
      const sourceStr = formatReferences({
        references: [statement.informationSource],
        label: "Source",
        isDebug,
      });
      if (sourceStr) parts.push(sourceStr);
    }

    const derivedFromStr = formatReferences({
      references: statement.derivedFrom,
      label: "Derived From",
      isDebug,
    });
    if (derivedFromStr) parts.push(derivedFromStr);

    const reasonStr = formatCodeableConcepts({
      concepts: statement.reasonCode,
      label: "Reason",
      isDebug,
    });
    if (reasonStr) parts.push(reasonStr);

    const dosageStr = formatDosages({ dosages: statement.dosage, label: "Dosage", isDebug });
    if (dosageStr) parts.push(dosageStr);

    const notes = formatAnnotations({ annotations: statement.note, label: "Note", isDebug });
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
