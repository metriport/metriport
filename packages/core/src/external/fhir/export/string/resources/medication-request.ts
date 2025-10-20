import { MedicationRequest } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatDosages } from "../shared/dosage";
import { formatDuration } from "../shared/duration";
import { formatIdentifier, formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatQuantity } from "../shared/quantity";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR MedicationRequest resource to a string representation
 */
export class MedicationRequestToString implements FHIRResourceToString<MedicationRequest> {
  toString(request: MedicationRequest, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: request.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (request.status) parts.push(isDebug ? `Status: ${request.status}` : request.status);

    const statusReasonStr = formatCodeableConcept({
      concept: request.statusReason,
      label: "Status Reason",
      isDebug,
    });
    if (statusReasonStr) parts.push(statusReasonStr);

    if (request.intent) parts.push(isDebug ? `Intent: ${request.intent}` : request.intent);

    const categoryStr = formatCodeableConcepts({
      concepts: request.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) {
      parts.push(categoryStr);
      hasMinimumData = true;
    }

    if (request.priority) parts.push(isDebug ? `Priority: ${request.priority}` : request.priority);

    if (request.doNotPerform) parts.push("Do Not Perform");

    if (request.reportedBoolean) parts.push("Reported");

    const reportedStr = formatReference({
      reference: request.reportedReference,
      label: "Reported By",
      isDebug,
    });
    if (reportedStr) parts.push(reportedStr);

    const medicationStr = formatCodeableConcept({
      concept: request.medicationCodeableConcept,
      label: "Medication",
      isDebug,
    });
    if (medicationStr) {
      parts.push(medicationStr);
      hasMinimumData = true;
    }

    const medicationRefStr = formatReference({
      reference: request.medicationReference,
      label: "Medication",
      isDebug,
    });
    if (medicationRefStr) parts.push(medicationRefStr);

    // const subjectStr = formatReference({ reference: request.subject, label: "Subject", isDebug });
    // if (subjectStr) parts.push(subjectStr);

    const encounterStr = formatReference({
      reference: request.encounter,
      label: "Encounter",
      isDebug,
    });
    if (encounterStr) parts.push(encounterStr);

    const infoStr = formatReferences({
      references: request.supportingInformation,
      label: "Supporting Information",
      isDebug,
    });
    if (infoStr) parts.push(infoStr);

    if (request.authoredOn)
      parts.push(isDebug ? `Authored On: ${request.authoredOn}` : request.authoredOn);

    const requesterStr = formatReference({
      reference: request.requester,
      label: "Requester",
      isDebug,
    });
    if (requesterStr) parts.push(requesterStr);

    const performerStr = formatReference({
      reference: request.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) parts.push(performerStr);

    const typeStr = formatCodeableConcept({
      concept: request.performerType,
      label: "Performer Type",
      isDebug,
    });
    if (typeStr) parts.push(typeStr);

    const recorderStr = formatReference({
      reference: request.recorder,
      label: "Recorder",
      isDebug,
    });
    if (recorderStr) parts.push(recorderStr);

    const reasonStr = formatCodeableConcepts({
      concepts: request.reasonCode,
      label: "Reason",
      isDebug,
    });
    if (reasonStr) parts.push(reasonStr);

    const reasonRefStr = formatReferences({
      references: request.reasonReference,
      label: "Reason Reference",
      isDebug,
    });
    if (reasonRefStr) parts.push(reasonRefStr);

    // if (request.instantiatesCanonical) {
    //   const instCanonical = request.instantiatesCanonical.join(FIELD_SEPARATOR);
    //   parts.push(isDebug ? `Instantiates Canonical: ${instCanonical}` : instCanonical);
    // }

    // if (request.instantiatesUri) {
    //   const instUri = request.instantiatesUri.join(FIELD_SEPARATOR);
    //   parts.push(isDebug ? `Instantiates URI: ${instUri}` : instUri);
    // }

    const basedOnStr = formatReferences({
      references: request.basedOn,
      label: "Based On",
      isDebug,
    });
    if (basedOnStr) parts.push(basedOnStr);

    const groupStr = formatIdentifier({ identifier: request.groupIdentifier });
    if (groupStr) parts.push(isDebug ? `Group Identifier: ${groupStr}` : groupStr);

    const courseStr = formatCodeableConcept({
      concept: request.courseOfTherapyType,
      label: "Course of Therapy",
      isDebug,
    });
    if (courseStr) parts.push(courseStr);

    const insuranceStr = formatReferences({
      references: request.insurance,
      label: "Insurance",
      isDebug,
    });
    if (insuranceStr) parts.push(insuranceStr);

    const notes = formatAnnotations({ annotations: request.note, label: "Notes", isDebug });
    if (notes) parts.push(notes);

    const dosages = formatDosages({
      dosages: request.dosageInstruction,
      label: "Dosage Instructions",
      isDebug,
    });
    if (dosages) parts.push(dosages);

    if (request.dispenseRequest) {
      const dispense = request.dispenseRequest;
      const dispenseParts: string[] = [];

      if (dispense.initialFill) {
        const initialFillParts = [];
        const quantityStr = formatQuantity({
          quantity: dispense.initialFill.quantity,
          label: "Quantity",
          isDebug,
        });
        if (quantityStr) initialFillParts.push(quantityStr);

        const durationStr = formatDuration({ duration: dispense.initialFill.duration, isDebug });
        if (durationStr) initialFillParts.push(isDebug ? `Duration: ${durationStr}` : durationStr);

        if (initialFillParts.length > 0) {
          const initialFillStr = initialFillParts.join(FIELD_SEPARATOR);
          dispenseParts.push(isDebug ? `Initial Fill: ${initialFillStr}` : initialFillStr);
        }
      }

      const intervalStr = formatDuration({
        duration: dispense.dispenseInterval,
        label: "Dispense Interval",
        isDebug,
      });
      if (intervalStr) dispenseParts.push(intervalStr);

      const periodStr = formatPeriod({
        period: dispense.validityPeriod,
        label: "Validity Period",
        isDebug,
      });
      if (periodStr) dispenseParts.push(periodStr);

      if (dispense.numberOfRepeatsAllowed !== undefined) {
        dispenseParts.push(
          isDebug
            ? `Repeats Allowed: ${dispense.numberOfRepeatsAllowed}`
            : String(dispense.numberOfRepeatsAllowed)
        );
      }

      const quantityStr = formatQuantity({
        quantity: dispense.quantity,
        label: "Quantity",
        isDebug,
      });
      if (quantityStr) dispenseParts.push(quantityStr);

      const durationStr = formatDuration({
        duration: dispense.expectedSupplyDuration,
        label: "Expected Supply Duration",
        isDebug,
      });
      if (durationStr) dispenseParts.push(durationStr);

      const performerStr = formatReference({
        reference: dispense.performer,
        label: "Dispense Performer",
        isDebug,
      });
      if (performerStr) dispenseParts.push(performerStr);

      if (dispenseParts.length > 0) {
        const dispenseStr = dispenseParts.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Dispense Request: ${dispenseStr}` : dispenseStr);
        hasMinimumData = true;
      }
    }

    if (request.substitution) {
      const substitution = request.substitution;
      const substitutionParts = [];

      if (substitution.allowedBoolean) substitutionParts.push("Substitution Allowed");

      const allowedStr = formatCodeableConcept({
        concept: substitution.allowedCodeableConcept,
        label: "Allowed",
        isDebug,
      });
      if (allowedStr) substitutionParts.push(allowedStr);

      const reasonStr = formatCodeableConcept({
        concept: substitution.reason,
        label: "Reason",
        isDebug,
      });
      if (reasonStr) substitutionParts.push(reasonStr);

      if (substitutionParts.length > 0) {
        const substitutionStr = substitutionParts.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Substitution: ${substitutionStr}` : substitutionStr);
      }
    }

    const priorStr = formatReference({
      reference: request.priorPrescription,
      label: "Prior Prescription",
      isDebug,
    });
    if (priorStr) parts.push(priorStr);

    const issuesStr = formatReferences({
      references: request.detectedIssue,
      label: "Detected Issues",
      isDebug,
    });
    if (issuesStr) parts.push(issuesStr);

    const historyStr = formatReferences({
      references: request.eventHistory,
      label: "Event History",
      isDebug,
    });
    if (historyStr) parts.push(historyStr);

    const textStr = formatNarrative({ narrative: request.text, label: "Text", isDebug });
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
