import { Procedure } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts, formatCodeableConcept } from "../shared/codeable-concept";
import { formatReferences } from "../shared/reference";
import { formatPeriod } from "../shared/period";

/**
 * Converts a FHIR Procedure resource to a string representation
 */
export class ProcedureToString implements FHIRResourceToString<Procedure> {
  toString(procedure: Procedure): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(procedure.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (procedure.status) {
      parts.push(`Status: ${procedure.status}`);
    }

    if (procedure.category) {
      const categoryStr = formatCodeableConcept(procedure.category);
      if (categoryStr) {
        parts.push(`Category: ${categoryStr}`);
      }
    }

    if (procedure.code) {
      const codeStr = formatCodeableConcept(procedure.code);
      if (codeStr) {
        parts.push(`Code: ${codeStr}`);
      }
    }

    // if (procedure.subject) {
    //   const subjectStr = formatReferences([procedure.subject], "Subject");
    //   if (subjectStr) {
    //     parts.push(subjectStr);
    //   }
    // }

    if (procedure.performedDateTime) {
      parts.push(`Performed: ${procedure.performedDateTime}`);
    } else if (procedure.performedPeriod) {
      const performedStr = formatPeriod(procedure.performedPeriod, "Performed");
      if (performedStr) {
        parts.push(performedStr);
      }
    }

    if (procedure.recorder) {
      const recorderStr = formatReferences([procedure.recorder], "Recorder");
      if (recorderStr) {
        parts.push(recorderStr);
      }
    }

    if (procedure.asserter) {
      const asserterStr = formatReferences([procedure.asserter], "Asserter");
      if (asserterStr) {
        parts.push(asserterStr);
      }
    }

    const performerStr = formatReferences(procedure.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    if (procedure.reasonCode) {
      const reasonStr = formatCodeableConcepts(procedure.reasonCode, "Reason");
      if (reasonStr) {
        parts.push(reasonStr);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
