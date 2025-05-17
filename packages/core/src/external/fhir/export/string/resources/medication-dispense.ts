import { MedicationDispense } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationDispense resource to a string representation
 */
export class MedicationDispenseToString implements FHIRResourceToString<MedicationDispense> {
  toString(dispense: MedicationDispense): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers(dispense.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (dispense.status) {
      parts.push(`Status: ${dispense.status}`);
    }

    const categoryStr = formatCodeableConcepts(
      dispense.category ? [dispense.category] : undefined,
      "Category"
    );
    if (categoryStr) {
      parts.push(categoryStr);
    }

    if (dispense.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts(
        [dispense.medicationCodeableConcept],
        "Medication"
      );
      if (medicationStr) {
        parts.push(medicationStr);
        hasMinimumData = true;
      }
    } else if (dispense.medicationReference) {
      const medicationStr = formatReferences([dispense.medicationReference], "Medication");
      if (medicationStr) {
        parts.push(medicationStr);
      }
    }

    // if (dispense.subject) {
    //   const subjectStr = formatReferences([dispense.subject], "Subject");
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //   }
    // }

    if (dispense.context) {
      const contextStr = formatReferences([dispense.context], "Context");
      if (contextStr) {
        parts.push(contextStr);
      }
    }

    const supportingInfoStr = formatReferences(dispense.supportingInformation, "Supporting Info");
    if (supportingInfoStr) {
      parts.push(supportingInfoStr);
    }

    const performerStr = formatReferences(dispense.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    if (dispense.location) {
      const locationStr = formatReferences([dispense.location], "Location");
      if (locationStr) {
        parts.push(locationStr);
      }
    }

    const prescriptionStr = formatReferences(dispense.authorizingPrescription, "Prescription");
    if (prescriptionStr) {
      parts.push(prescriptionStr);
    }

    if (dispense.type) {
      const typeStr = formatCodeableConcepts([dispense.type], "Type");
      if (typeStr) {
        parts.push(typeStr);
      }
    }

    if (dispense.quantity) {
      const quantityStr = formatQuantity(dispense.quantity, "Quantity");
      if (quantityStr) {
        parts.push(quantityStr);
      }
    }

    // if (dispense.daysSupply) {
    //   const daysSupplyStr = formatQuantity(dispense.daysSupply, "Days Supply");
    //   if (daysSupplyStr) {
    //     parts.push(daysSupplyStr);
    //   }
    // }

    if (dispense.whenPrepared) {
      parts.push(`Prepared: ${dispense.whenPrepared}`);
    }

    if (dispense.whenHandedOver) {
      parts.push(`Handed Over: ${dispense.whenHandedOver}`);
    }

    if (dispense.destination) {
      const destinationStr = formatReferences([dispense.destination], "Destination");
      if (destinationStr) {
        parts.push(destinationStr);
      }
    }

    const receiverStr = formatReferences(dispense.receiver, "Receiver");
    if (receiverStr) {
      parts.push(receiverStr);
    }

    const notes = formatAnnotations(dispense.note, "Note");
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
