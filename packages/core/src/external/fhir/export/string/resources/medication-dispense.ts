import { MedicationDispense } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatReferences } from "../shared/reference";
import { formatQuantity } from "../shared/quantity";

/**
 * Converts a FHIR MedicationDispense resource to a string representation
 */
export class MedicationDispenseToString implements FHIRResourceToString<MedicationDispense> {
  toString(dispense: MedicationDispense): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(dispense.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (dispense.status) {
      parts.push(`Status: ${dispense.status}`);
    }

    // Add category
    const categoryStr = formatCodeableConcepts(
      dispense.category ? [dispense.category] : undefined,
      "Category"
    );
    if (categoryStr) {
      parts.push(categoryStr);
    }

    // Add medication
    if (dispense.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts(
        [dispense.medicationCodeableConcept],
        "Medication"
      );
      if (medicationStr) {
        parts.push(medicationStr);
      }
    } else if (dispense.medicationReference) {
      const medicationStr = formatReferences([dispense.medicationReference], "Medication");
      if (medicationStr) {
        parts.push(medicationStr);
      }
    }

    // Add subject
    if (dispense.subject) {
      const subjectStr = formatReferences([dispense.subject], "Subject");
      if (subjectStr) {
        parts.push(subjectStr);
      }
    }

    // Add context
    if (dispense.context) {
      const contextStr = formatReferences([dispense.context], "Context");
      if (contextStr) {
        parts.push(contextStr);
      }
    }

    // Add supporting information
    const supportingInfoStr = formatReferences(dispense.supportingInformation, "Supporting Info");
    if (supportingInfoStr) {
      parts.push(supportingInfoStr);
    }

    // Add performer
    const performerStr = formatReferences(dispense.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    // Add location
    if (dispense.location) {
      const locationStr = formatReferences([dispense.location], "Location");
      if (locationStr) {
        parts.push(locationStr);
      }
    }

    // Add authorizing prescription
    const prescriptionStr = formatReferences(dispense.authorizingPrescription, "Prescription");
    if (prescriptionStr) {
      parts.push(prescriptionStr);
    }

    // Add type
    if (dispense.type) {
      const typeStr = formatCodeableConcepts([dispense.type], "Type");
      if (typeStr) {
        parts.push(typeStr);
      }
    }

    // Add quantity
    if (dispense.quantity) {
      const quantityStr = formatQuantity(dispense.quantity, "Quantity");
      if (quantityStr) {
        parts.push(quantityStr);
      }
    }

    // Add days supply
    if (dispense.daysSupply) {
      const daysSupplyStr = formatQuantity(dispense.daysSupply, "Days Supply");
      if (daysSupplyStr) {
        parts.push(daysSupplyStr);
      }
    }

    // Add when prepared
    if (dispense.whenPrepared) {
      parts.push(`Prepared: ${dispense.whenPrepared}`);
    }

    // Add when handed over
    if (dispense.whenHandedOver) {
      parts.push(`Handed Over: ${dispense.whenHandedOver}`);
    }

    // Add destination
    if (dispense.destination) {
      const destinationStr = formatReferences([dispense.destination], "Destination");
      if (destinationStr) {
        parts.push(destinationStr);
      }
    }

    // Add receiver
    const receiverStr = formatReferences(dispense.receiver, "Receiver");
    if (receiverStr) {
      parts.push(receiverStr);
    }

    // Add note
    if (dispense.note) {
      const notes = dispense.note
        .map(note => note.text)
        .filter(Boolean)
        .join(FIELD_SEPARATOR);
      if (notes) {
        parts.push(`Note: ${notes}`);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
