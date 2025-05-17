import { MedicationAdministration } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationAdministration resource to a string representation
 */
export class MedicationAdministrationToString
  implements FHIRResourceToString<MedicationAdministration>
{
  toString(administration: MedicationAdministration): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    if (administration.identifier) {
      const identifierStr = formatIdentifiers(administration.identifier);
      if (identifierStr) parts.push(identifierStr);
    }

    if (administration.status) {
      parts.push(`Status: ${administration.status}`);
      hasMinimumData = true;
    }

    const effectivePeriodStr = formatPeriod(administration.effectivePeriod, "Effective Period");
    if (effectivePeriodStr) {
      parts.push(effectivePeriodStr);
      hasMinimumData = true;
    }

    if (administration.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts(
        [administration.medicationCodeableConcept],
        "Medication"
      );
      if (medicationStr) {
        parts.push(medicationStr);
        hasMinimumData = true;
      }
    } else if (administration.medicationReference) {
      const medicationStr = formatReferences([administration.medicationReference], "Medication");
      if (medicationStr) {
        parts.push(medicationStr);
        hasMinimumData = true;
      }
    }

    // if (administration.subject) {
    //   const subjectStr = formatReferences([administration.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    if (administration.context) {
      const contextStr = formatReferences([administration.context], "Context");
      if (contextStr) parts.push(contextStr);
    }

    if (administration.effectiveDateTime) {
      parts.push(`Effective Date: ${administration.effectiveDateTime}`);
      // hasMinimumData = true;
    }

    if (administration.performer) {
      const performers = administration.performer
        .map(performer => {
          const actor = performer.actor
            ? formatReferences([performer.actor], "Performer")
            : undefined;
          return actor;
        })
        .filter(Boolean);

      if (performers.length > 0) {
        parts.push(performers.join(FIELD_SEPARATOR));
        // hasMinimumData = true;
      }
    }

    if (administration.reasonCode) {
      const reasonStr = formatCodeableConcepts(administration.reasonCode, "Reason");
      if (reasonStr) {
        parts.push(reasonStr);
        hasMinimumData = true;
      }
    }

    if (administration.dosage) {
      const dosage = administration.dosage;
      const components = [
        dosage.route && formatCodeableConcepts([dosage.route], "Route"),
        dosage.method && formatCodeableConcepts([dosage.method], "Method"),
        dosage.dose && `Dose: ${dosage.dose.value} ${dosage.dose.unit}`,
        dosage.rateQuantity && `Rate: ${dosage.rateQuantity.value} ${dosage.rateQuantity.unit}`,
        dosage.text && `Text: ${dosage.text}`,
      ].filter(Boolean);

      if (components.length > 0) {
        parts.push(`Dosage: ${components.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
