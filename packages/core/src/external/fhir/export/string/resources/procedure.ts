import { Procedure } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatPeriod } from "../shared/period";
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

    return parts.join(FIELD_SEPARATOR);
  }
}
