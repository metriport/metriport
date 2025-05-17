import { Medication } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Medication resource to a string representation
 */
export class MedicationToString implements FHIRResourceToString<Medication> {
  toString(medication: Medication): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(medication.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (medication.code) {
      const codeStr = formatCodeableConcepts([medication.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
      }
    }

    if (medication.status) {
      parts.push(`Status: ${medication.status}`);
    }

    if (medication.manufacturer) {
      const manufacturerStr = formatReferences([medication.manufacturer], "Manufacturer");
      if (manufacturerStr) {
        parts.push(manufacturerStr);
      }
    }

    if (medication.form) {
      const formStr = formatCodeableConcepts([medication.form], "Form");
      if (formStr) {
        parts.push(formStr);
      }
    }

    if (medication.amount) {
      const amountStr = formatQuantity(medication.amount, "Amount");
      if (amountStr) {
        parts.push(amountStr);
      }
    }

    if (medication.ingredient) {
      const ingredients = medication.ingredient
        .map(ingredient => {
          const item = ingredient.itemCodeableConcept
            ? formatCodeableConcepts([ingredient.itemCodeableConcept], "Ingredient")
            : ingredient.itemReference
            ? formatReferences([ingredient.itemReference], "Ingredient")
            : "";
          const strength = ingredient.strength
            ? formatQuantity(ingredient.strength, "Strength")
            : "";
          return [item, strength].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean)
        .join(FIELD_SEPARATOR);
      if (ingredients) {
        parts.push(ingredients);
      }
    }

    if (medication.batch) {
      const batch = medication.batch;
      const batchParts = [];
      if (batch.lotNumber) {
        batchParts.push(`Lot: ${batch.lotNumber}`);
      }
      if (batch.expirationDate) {
        batchParts.push(`Expires: ${batch.expirationDate}`);
      }
      if (batchParts.length > 0) {
        parts.push(`Batch: ${batchParts.join(FIELD_SEPARATOR)}`);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
