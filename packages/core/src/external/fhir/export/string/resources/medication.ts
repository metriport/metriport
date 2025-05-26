import { Medication } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Medication resource to a string representation
 */
export class MedicationToString implements FHIRResourceToString<Medication> {
  toString(medication: Medication, isDebug?: boolean): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: medication.identifier });
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (medication.code) {
      const codeStr = formatCodeableConcepts({
        concepts: [medication.code],
        label: "Code",
        isDebug,
      });
      if (codeStr) parts.push(codeStr);
    }

    if (medication.status) {
      parts.push(isDebug ? `Status: ${medication.status}` : medication.status);
    }

    if (medication.manufacturer) {
      const manufacturerStr = formatReferences({
        references: [medication.manufacturer],
        label: "Manufacturer",
        isDebug,
      });
      if (manufacturerStr) {
        parts.push(manufacturerStr);
      }
    }

    if (medication.form) {
      const formStr = formatCodeableConcepts({
        concepts: [medication.form],
        label: "Form",
        isDebug,
      });
      if (formStr) {
        parts.push(formStr);
      }
    }

    if (medication.amount) {
      const amountStr = formatQuantity({ quantity: medication.amount, label: "Amount", isDebug });
      if (amountStr) {
        parts.push(amountStr);
      }
    }

    const ingredients = medication.ingredient
      ?.map(ingredient => {
        const item = formatCodeableConcept({
          concept: ingredient.itemCodeableConcept,
          label: "Ingredient",
          isDebug,
        });
        // : ingredient.itemReference
        // ? formatReferences({
        //     references: [ingredient.itemReference],
        //     label: "Ingredient",
        //     isDebug,
        //   })
        const strength = formatQuantity({
          quantity: ingredient.strength,
          label: "Strength",
          isDebug,
        });
        return [item, strength].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .filter(Boolean)
      .join(FIELD_SEPARATOR);
    if (ingredients) {
      parts.push(ingredients);
    }

    if (medication.batch) {
      const batch = medication.batch;
      const batchParts = [];
      if (batch.lotNumber) {
        batchParts.push(isDebug ? `Lot: ${batch.lotNumber}` : batch.lotNumber);
      }
      if (batch.expirationDate) {
        batchParts.push(isDebug ? `Expires: ${batch.expirationDate}` : batch.expirationDate);
      }
      if (batchParts.length > 0) {
        const batchStr = batchParts.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Batch: ${batchStr}` : batchStr);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
