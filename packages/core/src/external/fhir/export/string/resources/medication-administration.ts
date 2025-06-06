import { MedicationAdministration } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatQuantity } from "../shared/quantity";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationAdministration resource to a string representation
 */
export class MedicationAdministrationToString
  implements FHIRResourceToString<MedicationAdministration>
{
  toString(administration: MedicationAdministration, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: administration.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (administration.status) {
      parts.push(isDebug ? `Status: ${administration.status}` : administration.status);
      hasMinimumData = true;
    }

    const effectivePeriodStr = formatPeriod({
      period: administration.effectivePeriod,
      label: "Effective Period",
      isDebug,
    });
    if (effectivePeriodStr) {
      parts.push(effectivePeriodStr);
      hasMinimumData = true;
    }

    const medicationStr = formatCodeableConcept({
      concept: administration.medicationCodeableConcept,
      label: "Medication",
      isDebug,
    });
    if (medicationStr) {
      parts.push(medicationStr);
      hasMinimumData = true;
    }

    const medicationRefStr = formatReference({
      reference: administration.medicationReference,
      label: "Medication",
      isDebug,
    });
    if (medicationRefStr) {
      parts.push(medicationRefStr);
      hasMinimumData = true;
    }

    // if (administration.subject) {
    //   const subjectStr = formatReferences([administration.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    const contextStr = formatReference({
      reference: administration.context,
      label: "Context",
      isDebug,
    });
    if (contextStr) parts.push(contextStr);

    if (administration.effectiveDateTime) {
      parts.push(
        isDebug
          ? `Effective Date: ${administration.effectiveDateTime}`
          : administration.effectiveDateTime
      );
      // hasMinimumData = true;
    }

    const performers = administration.performer
      ?.map(performer => {
        const actor = performer.actor
          ? formatReferences({ references: [performer.actor], label: "Performer", isDebug })
          : undefined;
        return actor;
      })
      .filter(Boolean);
    if (performers && performers.length > 0) {
      parts.push(performers.join(FIELD_SEPARATOR));
      // hasMinimumData = true;
    }

    const reasonStr = formatCodeableConcepts({
      concepts: administration.reasonCode,
      label: "Reason",
      isDebug,
    });
    if (reasonStr) {
      parts.push(reasonStr);
      hasMinimumData = true;
    }

    if (administration.dosage) {
      const dosage = administration.dosage;
      const components = [
        formatCodeableConcept({ concept: dosage.route, label: "Route", isDebug }),
        formatCodeableConcept({ concept: dosage.method, label: "Method", isDebug }),
        formatQuantity({ quantity: dosage.dose, label: "Dose", isDebug }),
        formatQuantity({ quantity: dosage.rateQuantity, label: "Rate", isDebug }),
        dosage.text && (isDebug ? `Text: ${dosage.text}` : dosage.text),
      ].filter(Boolean);
      if (components.length > 0) {
        const componentsStr = components.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Dosage: ${componentsStr}` : componentsStr);
        hasMinimumData = true;
      }
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
