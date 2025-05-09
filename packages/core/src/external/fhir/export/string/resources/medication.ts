import { Medication } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatReferences } from "../shared/reference";
import { formatQuantity } from "../shared/quantity";

/**
 * Converts a FHIR Medication resource to a string representation
 */
export class MedicationToString implements FHIRResourceToString<Medication> {
  toString(medication: Medication): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(medication.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add code
    if (medication.code) {
      const codeStr = formatCodeableConcepts([medication.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
      }
    }

    // Add status
    if (medication.status) {
      parts.push(`Status: ${medication.status}`);
    }

    // Add manufacturer
    if (medication.manufacturer) {
      const manufacturerStr = formatReferences([medication.manufacturer], "Manufacturer");
      if (manufacturerStr) {
        parts.push(manufacturerStr);
      }
    }

    // Add form
    if (medication.form) {
      const formStr = formatCodeableConcepts([medication.form], "Form");
      if (formStr) {
        parts.push(formStr);
      }
    }

    // Add amount
    if (medication.amount) {
      const amountStr = formatQuantity(medication.amount, "Amount");
      if (amountStr) {
        parts.push(amountStr);
      }
    }

    // Add ingredient
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
          return [item, strength].filter(Boolean).join(" ");
        })
        .filter(Boolean)
        .join(FIELD_SEPARATOR);
      if (ingredients) {
        parts.push(ingredients);
      }
    }

    // Add batch
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
        parts.push(`Batch: ${batchParts.join(", ")}`);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
