import { Procedure } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts, formatCodeableConcept } from "../shared/codeable-concept";
import { formatReferences } from "../shared/reference";
import { formatPeriod } from "../shared/period";

/**
 * Converts a FHIR Procedure resource to a string representation
 */
export class ProcedureToString implements FHIRResourceToString<Procedure> {
  toString(procedure: Procedure): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(procedure.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (procedure.status) {
      parts.push(`Status: ${procedure.status}`);
    }

    // Add category
    if (procedure.category) {
      const categoryStr = formatCodeableConcept(procedure.category);
      if (categoryStr) {
        parts.push(`Category: ${categoryStr}`);
      }
    }

    // Add code
    if (procedure.code) {
      const codeStr = formatCodeableConcept(procedure.code);
      if (codeStr) {
        parts.push(`Code: ${codeStr}`);
      }
    }

    // Add subject
    if (procedure.subject) {
      const subjectStr = formatReferences([procedure.subject], "Subject");
      if (subjectStr) {
        parts.push(subjectStr);
      }
    }

    // Add performed time
    if (procedure.performedDateTime) {
      parts.push(`Performed: ${procedure.performedDateTime}`);
    } else if (procedure.performedPeriod) {
      const performedStr = formatPeriod(procedure.performedPeriod, "Performed");
      if (performedStr) {
        parts.push(performedStr);
      }
    }

    // Add recorder
    if (procedure.recorder) {
      const recorderStr = formatReferences([procedure.recorder], "Recorder");
      if (recorderStr) {
        parts.push(recorderStr);
      }
    }

    // Add asserter
    if (procedure.asserter) {
      const asserterStr = formatReferences([procedure.asserter], "Asserter");
      if (asserterStr) {
        parts.push(asserterStr);
      }
    }

    // Add performer
    const performerStr = formatReferences(procedure.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    // Add reason
    if (procedure.reasonCode) {
      const reasonStr = formatCodeableConcepts(procedure.reasonCode, "Reason");
      if (reasonStr) {
        parts.push(reasonStr);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
