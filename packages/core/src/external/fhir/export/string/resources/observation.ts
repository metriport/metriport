import { Observation, ObservationReferenceRange } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTiming } from "../shared/timing";

/**
 * Converts a FHIR Observation resource to a string representation
 */
export class ObservationToString implements FHIRResourceToString<Observation> {
  toString(observation: Observation, isDebug?: boolean): string {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: observation.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (observation.status) {
      parts.push(isDebug ? `Status: ${observation.status}` : observation.status);
    }

    const categoryStr = formatCodeableConcepts({
      concepts: observation.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    const codeStr = formatCodeableConcept({ concept: observation.code, label: "Code", isDebug });
    if (codeStr) parts.push(codeStr);

    const valueStr = formatQuantity({
      quantity: observation.valueQuantity,
      label: "Value",
      isDebug,
    });
    if (valueStr) parts.push(valueStr);

    const referenceRanges = observation.referenceRange
      ?.map((rr: ObservationReferenceRange) => {
        const lowStr = formatQuantity({ quantity: rr.low, label: "Low", isDebug });
        const highStr = formatQuantity({ quantity: rr.high, label: "High", isDebug });
        return [lowStr, highStr].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (referenceRanges && referenceRanges.length > 0) {
      const referenceRangeStr = referenceRanges.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Reference Range: ${referenceRangeStr}` : referenceRangeStr);
    }

    const valueCodeableConceptStr = formatCodeableConcept({
      concept: observation.valueCodeableConcept,
      label: "Value",
      isDebug,
    });
    if (valueCodeableConceptStr) parts.push(valueCodeableConceptStr);

    const interpretationStr = formatCodeableConcepts({
      concepts: observation.interpretation,
      label: "Interpretation",
      isDebug,
    });
    if (interpretationStr) parts.push(interpretationStr);

    if (observation.effectiveDateTime) {
      parts.push(
        isDebug ? `Effective: ${observation.effectiveDateTime}` : observation.effectiveDateTime
      );
    }

    const periodStr = formatPeriod({ period: observation.effectivePeriod, isDebug });
    if (periodStr) parts.push(periodStr);

    const timingStr = formatTiming({ timing: observation.effectiveTiming });
    if (timingStr) parts.push(timingStr);

    if (observation.effectiveInstant) {
      parts.push(
        isDebug ? `Effective: ${observation.effectiveInstant}` : observation.effectiveInstant
      );
    }

    if (observation.issued) {
      parts.push(isDebug ? `Issued: ${observation.issued}` : observation.issued);
    }

    const performerStr = formatReferences({
      references: observation.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) parts.push(performerStr);

    const dataAbsentReasonStr = formatCodeableConcept({
      concept: observation.dataAbsentReason,
      label: "Data Absent Reason",
      isDebug,
    });
    if (dataAbsentReasonStr) parts.push(dataAbsentReasonStr);

    const notes = formatAnnotations({ annotations: observation.note, label: "Note", isDebug });
    if (notes) parts.push(notes);

    const bodySiteStr = formatCodeableConcept({
      concept: observation.bodySite,
      label: "Body Site",
      isDebug,
    });
    if (bodySiteStr) parts.push(bodySiteStr);

    const methodStr = formatCodeableConcept({
      concept: observation.method,
      label: "Method",
      isDebug,
    });
    if (methodStr) parts.push(methodStr);

    return parts.join(FIELD_SEPARATOR);
  }
}
