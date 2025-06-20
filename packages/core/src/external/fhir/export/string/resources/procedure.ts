import { Procedure } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAge } from "../shared/age";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
import { formatRange } from "../shared/range";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Procedure resource to a string representation
 */
export class ProcedureToString implements FHIRResourceToString<Procedure> {
  toString(procedure: Procedure, isDebug?: boolean): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: procedure.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (procedure.status) {
      parts.push(isDebug ? `Status: ${procedure.status}` : procedure.status);
    }

    const categoryStr = formatCodeableConcept({ concept: procedure.category, isDebug });
    if (categoryStr) parts.push(isDebug ? `Category: ${categoryStr}` : categoryStr);

    const codeStr = formatCodeableConcept({ concept: procedure.code, isDebug });
    if (codeStr) parts.push(isDebug ? `Code: ${codeStr}` : codeStr);

    // if (procedure.subject) {
    //   const subjectStr = formatReferences([procedure.subject], "Subject");
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //   }
    // }

    if (procedure.performedDateTime) {
      parts.push(
        isDebug ? `Performed: ${procedure.performedDateTime}` : procedure.performedDateTime
      );
    }

    const performedAgeStr = formatAge({
      age: procedure.performedAge,
      label: "Performed age",
      isDebug,
    });
    if (performedAgeStr) parts.push(performedAgeStr);

    const performedRangeStr = formatRange({
      range: procedure.performedRange,
      label: "Performed range",
      isDebug,
    });
    if (performedRangeStr) parts.push(performedRangeStr);

    if (procedure.performedString) {
      parts.push(
        isDebug ? `Performed string: ${procedure.performedString}` : procedure.performedString
      );
    }

    const performedStr = formatPeriod({
      period: procedure.performedPeriod,
      label: "Performed",
      isDebug,
    });
    if (performedStr) parts.push(performedStr);

    const recorderStr = formatReference({
      reference: procedure.recorder,
      label: "Recorder",
      isDebug,
    });
    if (recorderStr) parts.push(recorderStr);

    const asserterStr = formatReference({
      reference: procedure.asserter,
      label: "Asserter",
      isDebug,
    });
    if (asserterStr) parts.push(asserterStr);

    const performerStr = formatReferences({
      references: procedure.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) parts.push(performerStr);

    const reasonStr = formatCodeableConcepts({
      concepts: procedure.reasonCode,
      label: "Reason",
      isDebug,
    });
    if (reasonStr) parts.push(reasonStr);

    const usedCodeStr = formatCodeableConcepts({
      concepts: procedure.usedCode,
      label: "Used Code",
      isDebug,
    });
    if (usedCodeStr) parts.push(usedCodeStr);

    const complicationStr = formatCodeableConcepts({
      concepts: procedure.complication,
      label: "Complication",
      isDebug,
    });
    if (complicationStr) parts.push(complicationStr);

    const followUpStr = formatCodeableConcepts({
      concepts: procedure.followUp,
      label: "Follow Up",
      isDebug,
    });
    if (followUpStr) parts.push(followUpStr);

    const notes = formatAnnotations({ annotations: procedure.note, label: "Note", isDebug });
    if (notes) parts.push(notes);

    return parts.join(FIELD_SEPARATOR);
  }
}
