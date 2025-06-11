import { Encounter } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatCoding } from "../shared/coding";
import { emptyIfDenied } from "../shared/deny";
import { formatIdentifier, formatIdentifiers } from "../shared/identifier";
import { formatReference } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Encounter resource to a string representation
 */
export class EncounterToString implements FHIRResourceToString<Encounter> {
  toString(encounter: Encounter, isDebug?: boolean): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers({ identifiers: encounter.identifier });
    if (identifierStr) {
      parts.push(identifierStr);
    }

    const status = emptyIfDenied(encounter.status);
    if (status) {
      parts.push(isDebug ? `Status: ${status}` : status);
      hasMinimumData = true;
    }

    const codeStr = formatCoding({ coding: encounter.class });
    if (codeStr) {
      parts.push(isDebug ? `Class: ${codeStr}` : codeStr);
      hasMinimumData = true;
    }

    const types = formatCodeableConcepts({ concepts: encounter.type, label: "Type", isDebug });
    if (types) {
      parts.push(types);
      hasMinimumData = true;
    }

    const priorityStr = formatCodeableConcept({
      concept: encounter.priority,
      label: "Priority",
      isDebug,
    });
    if (priorityStr) {
      parts.push(priorityStr);
    }

    const serviceTypeStr = formatCodeableConcept({
      concept: encounter.serviceType,
      label: "Service Type",
      isDebug,
    });
    if (serviceTypeStr) {
      parts.push(serviceTypeStr);
    }

    const reasonCodes = formatCodeableConcepts({
      concepts: encounter.reasonCode,
      label: "Reason",
      isDebug,
    });
    if (reasonCodes) {
      parts.push(reasonCodes);
    }

    if (encounter.hospitalization) {
      const hospitalization = encounter.hospitalization;
      const hospitalizationParts = [];

      const preAdmissionIdentifierStr = formatIdentifier({
        identifier: hospitalization.preAdmissionIdentifier,
      });
      if (preAdmissionIdentifierStr) {
        hospitalizationParts.push(
          isDebug ? `Pre-admission ID: ${preAdmissionIdentifierStr}` : preAdmissionIdentifierStr
        );
      }

      const originStr = formatReference({
        reference: hospitalization.origin,
        label: "Origin",
        isDebug,
      });
      if (originStr) hospitalizationParts.push(originStr);

      const admitSourceStr = formatCodeableConcept({
        concept: hospitalization.admitSource,
        label: "Admit Source",
        isDebug,
      });
      if (admitSourceStr) hospitalizationParts.push(admitSourceStr);

      const reAdmissionStr = formatCodeableConcept({
        concept: hospitalization.reAdmission,
        label: "Re-admission",
        isDebug,
      });
      if (reAdmissionStr) hospitalizationParts.push(reAdmissionStr);

      const dietPreferences = formatCodeableConcepts({
        concepts: hospitalization.dietPreference,
        label: "Diet Preferences",
        isDebug,
      });
      if (dietPreferences) hospitalizationParts.push(dietPreferences);

      const specialCourtesy = formatCodeableConcepts({
        concepts: hospitalization.specialCourtesy,
        label: "Special Courtesy",
        isDebug,
      });
      if (specialCourtesy) hospitalizationParts.push(specialCourtesy);

      const specialArrangement = formatCodeableConcepts({
        concepts: hospitalization.specialArrangement,
        label: "Special Arrangement",
        isDebug,
      });
      if (specialArrangement) hospitalizationParts.push(specialArrangement);

      const destinationStr = formatReference({
        reference: hospitalization.destination,
        label: "Destination",
        isDebug,
      });
      if (destinationStr) hospitalizationParts.push(destinationStr);

      const dischargeDispositionStr = formatCodeableConcept({
        concept: hospitalization.dischargeDisposition,
        label: "Discharge Disposition",
        isDebug,
      });
      if (dischargeDispositionStr) hospitalizationParts.push(dischargeDispositionStr);

      const hospitalizationStr = hospitalizationParts.join(FIELD_SEPARATOR);
      if (hospitalizationStr) {
        parts.push(isDebug ? `Hospitalization: ${hospitalizationStr}` : hospitalizationStr);
      }
    }

    if (encounter.period) {
      const start = encounter.period.start ?? "unknown";
      const end = encounter.period.end ?? "ongoing";
      parts.push(isDebug ? `Period: ${start} to ${end}` : `${start} to ${end}`);
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
