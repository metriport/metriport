import { Composition, CompositionSection } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifier } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Composition resource to a string representation
 */
export class CompositionToString implements FHIRResourceToString<Composition> {
  toString(composition: Composition, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifier({ identifier: composition.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (composition.status) {
      parts.push(isDebug ? `Status: ${composition.status}` : composition.status);
    }

    const typeStr = formatCodeableConcept({
      concept: composition.type,
      label: "Type",
      isDebug,
    });
    if (typeStr) {
      parts.push(typeStr);
      hasMinimumData = true;
    }

    const categoryStr = formatCodeableConcepts({
      concepts: composition.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    // if (composition.subject) {
    //   const subjectStr = formatReferences([composition.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    if (composition.date) {
      parts.push(isDebug ? `Date: ${composition.date}` : composition.date);
    }

    if (composition.author) {
      const authorStr = formatReferences({
        references: composition.author,
        label: "Author",
        isDebug,
      });
      if (authorStr) parts.push(authorStr);
    }

    if (composition.attester) {
      const attestations = composition.attester
        .map(attester => {
          const mode = attester.mode
            ? isDebug
              ? `Mode: ${attester.mode}`
              : attester.mode
            : undefined;
          const time = attester.time
            ? isDebug
              ? `Time: ${attester.time}`
              : attester.time
            : undefined;
          const party = attester.party
            ? formatReferences({ references: [attester.party], label: "Party", isDebug })
            : undefined;
          return [mode, time, party].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (attestations.length > 0) {
        const attestationsStr = attestations.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Attestations: ${attestationsStr}` : attestationsStr);
        // hasMinimumData = true;
      }
    }

    const custodianStr = formatReference({
      reference: composition.custodian,
      label: "Custodian",
      isDebug,
    });
    if (custodianStr) parts.push(custodianStr);

    if (composition.title) {
      parts.push(isDebug ? `Title: ${composition.title}` : composition.title);
      hasMinimumData = true;
    }

    // if (composition.confidentiality) {
    //   parts.push(`Confidentiality: ${composition.confidentiality}`);
    // }

    const eventStr = composition.event
      ?.map(event => {
        const code = event.code ? (isDebug ? `Code: ${event.code}` : event.code) : undefined;
        const period = formatPeriod({ period: event.period, isDebug });
        return [code, period].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (eventStr) {
      const eventStrs = eventStr.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Service: ${eventStrs}` : eventStrs);
    }

    const sections = composition.section
      ?.map((section: CompositionSection) => {
        const title = section.title && isDebug ? `Title: ${section.title}` : section.title;
        const text = formatNarrative({ narrative: section.text, label: "Text", isDebug });
        const code = formatCodeableConcept({
          concept: section.code,
          label: "Code",
          isDebug,
        });
        return [title, text, code].filter(Boolean);
      })
      .filter(Boolean);
    if (sections && sections.length > 0) {
      const sectionsStr = sections.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Sections: ${sectionsStr}` : sectionsStr);
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
