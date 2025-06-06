import { MedicationDispense } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationDispense resource to a string representation
 */
export class MedicationDispenseToString implements FHIRResourceToString<MedicationDispense> {
  toString(dispense: MedicationDispense, isDebug?: boolean): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers({ identifiers: dispense.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (dispense.status) {
      parts.push(isDebug ? `Status: ${dispense.status}` : dispense.status);
    }

    const categoryStr = formatCodeableConcepts({
      concepts: dispense.category ? [dispense.category] : undefined,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    const medicationStr = formatCodeableConcept({
      concept: dispense.medicationCodeableConcept,
      label: "Medication",
      isDebug,
    });
    if (medicationStr) {
      parts.push(medicationStr);
      hasMinimumData = true;
    }

    const medicationRefStr = formatReference({
      reference: dispense.medicationReference,
      label: "Medication",
      isDebug,
    });
    if (medicationRefStr) parts.push(medicationRefStr);

    // if (dispense.subject) {
    //   const subjectStr = formatReferences({ references: [dispense.subject], label: "Subject", isDebug });
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //   }
    // }

    const contextStr = formatReference({
      reference: dispense.context,
      label: "Context",
      isDebug,
    });
    if (contextStr) parts.push(contextStr);

    const supportingInfoStr = formatReferences({
      references: dispense.supportingInformation,
      label: "Supporting Info",
      isDebug,
    });
    if (supportingInfoStr) parts.push(supportingInfoStr);

    const performerStr = formatReferences({
      references: dispense.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) parts.push(performerStr);

    const locationStr = formatReference({
      reference: dispense.location,
      label: "Location",
      isDebug,
    });
    if (locationStr) parts.push(locationStr);

    const prescriptionStr = formatReferences({
      references: dispense.authorizingPrescription,
      label: "Prescription",
      isDebug,
    });
    if (prescriptionStr) parts.push(prescriptionStr);

    const typeStr = formatCodeableConcept({ concept: dispense.type, label: "Type", isDebug });
    if (typeStr) parts.push(typeStr);

    const quantityStr = formatQuantity({
      quantity: dispense.quantity,
      label: "Quantity",
      isDebug,
    });
    if (quantityStr) parts.push(quantityStr);

    // if (dispense.daysSupply) {
    //   const daysSupplyStr = formatQuantity({ quantity: dispense.daysSupply, label: "Days Supply", isDebug });
    //   if (daysSupplyStr) {
    //     parts.push(daysSupplyStr);
    //   }
    // }

    if (dispense.whenPrepared) {
      parts.push(isDebug ? `Prepared: ${dispense.whenPrepared}` : dispense.whenPrepared);
    }

    if (dispense.whenHandedOver) {
      parts.push(isDebug ? `Handed Over: ${dispense.whenHandedOver}` : dispense.whenHandedOver);
    }

    const destinationStr = formatReference({
      reference: dispense.destination,
      label: "Destination",
      isDebug,
    });
    if (destinationStr) parts.push(destinationStr);

    const receiverStr = formatReferences({
      references: dispense.receiver,
      label: "Receiver",
      isDebug,
    });
    if (receiverStr) parts.push(receiverStr);

    const notes = formatAnnotations({ annotations: dispense.note, label: "Note", isDebug });
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
