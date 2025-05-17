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
  toString(request: MedicationRequest): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(request.identifier);
    if (identifierStr) parts.push(identifierStr);

    if (request.status) parts.push(`Status: ${request.status}`);

    if (request.statusReason) {
      const reasonStr = formatCodeableConcepts([request.statusReason], "Status Reason");
      if (reasonStr) parts.push(reasonStr);
    }

    if (request.intent) parts.push(`Intent: ${request.intent}`);

    const categoryStr = formatCodeableConcepts(request.category, "Category");
    if (categoryStr) {
      parts.push(categoryStr);
      hasMinimumData = true;
    }

    if (request.priority) parts.push(`Priority: ${request.priority}`);

    if (request.doNotPerform) parts.push(`Do Not Perform`);

    if (request.reportedBoolean) parts.push(`Reported`);

    const reportedStr = formatReference(request.reportedReference, "Reported By");
    if (reportedStr) parts.push(reportedStr);

    const medicationStr = formatCodeableConcept(request.medicationCodeableConcept, "Medication");
    if (medicationStr) {
      parts.push(medicationStr);
      hasMinimumData = true;
    }

    const medicationRefStr = formatReference(request.medicationReference, "Medication");
    if (medicationRefStr) parts.push(medicationRefStr);

    // const subjectStr = formatReference(request.subject, "Subject");
    // if (subjectStr) parts.push(subjectStr);

    const encounterStr = formatReference(request.encounter, "Encounter");
    if (encounterStr) parts.push(encounterStr);

    const infoStr = formatReferences(request.supportingInformation, "Supporting Information");
    if (infoStr) parts.push(infoStr);

    if (request.authoredOn) parts.push(`Authored On: ${request.authoredOn}`);

    const requesterStr = formatReference(request.requester, "Requester");
    if (requesterStr) parts.push(requesterStr);

    const performerStr = formatReference(request.performer, "Performer");
    if (performerStr) parts.push(performerStr);

    const typeStr = formatCodeableConcept(request.performerType, "Performer Type");
    if (typeStr) parts.push(typeStr);

    const recorderStr = formatReference(request.recorder, "Recorder");
    if (recorderStr) parts.push(recorderStr);

    const reasonStr = formatCodeableConcepts(request.reasonCode, "Reason");
    if (reasonStr) parts.push(reasonStr);

    const reasonRefStr = formatReferences(request.reasonReference, "Reason Reference");
    if (reasonRefStr) parts.push(reasonRefStr);

    if (request.instantiatesCanonical) {
      parts.push(`Instantiates Canonical: ${request.instantiatesCanonical.join(FIELD_SEPARATOR)}`);
    }

    if (request.instantiatesUri) {
      parts.push(`Instantiates URI: ${request.instantiatesUri.join(FIELD_SEPARATOR)}`);
    }

    const basedOnStr = formatReferences(request.basedOn, "Based On");
    if (basedOnStr) parts.push(basedOnStr);

    const groupStr = formatIdentifier(request.groupIdentifier);
    if (groupStr) parts.push(`Group Identifier: ${groupStr}`);

    const courseStr = formatCodeableConcept(request.courseOfTherapyType, "Course of Therapy");
    if (courseStr) parts.push(courseStr);

    const insuranceStr = formatReferences(request.insurance, "Insurance");
    if (insuranceStr) parts.push(insuranceStr);

    const notes = formatAnnotations(request.note, "Notes");
    if (notes) parts.push(notes);

    if (request.dosageInstruction) {
      const dosages = formatDosages(request.dosageInstruction, "Dosage Instructions");
      if (dosages) parts.push(dosages);
    }

    if (request.dispenseRequest) {
      const dispense = request.dispenseRequest;
      const dispenseParts: string[] = [];

      if (dispense.initialFill) {
        const initialFillParts = [];
        const quantityStr = formatQuantity(dispense.initialFill.quantity, "Quantity");
        if (quantityStr) initialFillParts.push(quantityStr);

        const durationStr = formatDuration(dispense.initialFill.duration);
        if (durationStr) initialFillParts.push(`Duration: ${durationStr}`);

        if (initialFillParts.length > 0) {
          dispenseParts.push(`Initial Fill: ${initialFillParts.join(FIELD_SEPARATOR)}`);
        }
      }

      const intervalStr = formatDuration(dispense.dispenseInterval, "Dispense Interval");
      if (intervalStr) dispenseParts.push(intervalStr);

      const periodStr = formatPeriod(dispense.validityPeriod, "Validity Period");
      if (periodStr) dispenseParts.push(periodStr);

      if (dispense.numberOfRepeatsAllowed !== undefined) {
        dispenseParts.push(`Repeats Allowed: ${dispense.numberOfRepeatsAllowed}`);
      }

      const quantityStr = formatQuantity(dispense.quantity, "Quantity");
      if (quantityStr) dispenseParts.push(quantityStr);

      const durationStr = formatDuration(
        dispense.expectedSupplyDuration,
        "Expected Supply Duration"
      );
      if (durationStr) dispenseParts.push(durationStr);

      const performerStr = formatReference(dispense.performer, "Dispense Performer");
      if (performerStr) dispenseParts.push(performerStr);

      if (dispenseParts.length > 0) {
        parts.push(`Dispense Request: ${dispenseParts.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    if (request.substitution) {
      const substitution = request.substitution;
      const substitutionParts = [];

      if (substitution.allowedBoolean) substitutionParts.push(`Substitution Allowed`);

      const allowedStr = formatCodeableConcept(substitution.allowedCodeableConcept, "Allowed");
      if (allowedStr) substitutionParts.push(allowedStr);

      const reasonStr = formatCodeableConcept(substitution.reason, "Reason");
      if (reasonStr) substitutionParts.push(reasonStr);

      if (substitutionParts.length > 0) {
        parts.push(`Substitution: ${substitutionParts.join(FIELD_SEPARATOR)}`);
      }
    }

    const priorStr = formatReference(request.priorPrescription, "Prior Prescription");
    if (priorStr) parts.push(priorStr);

    const issuesStr = formatReferences(request.detectedIssue, "Detected Issues");
    if (issuesStr) parts.push(issuesStr);

    const historyStr = formatReferences(request.eventHistory, "Event History");
    if (historyStr) parts.push(historyStr);

    const textStr = formatNarrative(request.text, "Text");
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
