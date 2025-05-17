import { MedicationStatement } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationStatement resource to a string representation
 */
export class MedicationStatementToString implements FHIRResourceToString<MedicationStatement> {
  toString(statement: MedicationStatement): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers(statement.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (statement.status) {
      parts.push(`Status: ${statement.status}`);
    }

    if (statement.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts(
        [statement.medicationCodeableConcept],
        "Medication"
      );
      if (medicationStr) {
        parts.push(medicationStr);
        hasMinimumData = true;
      }
    } else if (statement.medicationReference) {
      const medicationStr = formatReferences([statement.medicationReference], "Medication");
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
      parts.push(`Effective: ${statement.effectiveDateTime}`);
    } else if (statement.effectivePeriod) {
      const effectiveStr = formatPeriod(statement.effectivePeriod, "Effective");
      if (effectiveStr) {
        parts.push(effectiveStr);
      }
    }

    if (statement.dateAsserted) {
      parts.push(`Asserted: ${statement.dateAsserted}`);
    }

    if (statement.informationSource) {
      const sourceStr = formatReferences([statement.informationSource], "Source");
      if (sourceStr) {
        parts.push(sourceStr);
      }
    }

    const derivedFromStr = formatReferences(statement.derivedFrom, "Derived From");
    if (derivedFromStr) {
      parts.push(derivedFromStr);
    }

    const reasonStr = formatCodeableConcepts(statement.reasonCode, "Reason");
    if (reasonStr) {
      parts.push(reasonStr);
    }

    const notes = formatAnnotations(statement.note, "Note");
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
