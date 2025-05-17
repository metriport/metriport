import { Composition, CompositionSection } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Composition resource to a string representation
 */
export class CompositionToString implements FHIRResourceToString<Composition> {
  toString(composition: Composition): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    if (composition.identifier) {
      const identifierStr = formatIdentifiers([composition.identifier]);
      if (identifierStr) parts.push(identifierStr);
    }

    if (composition.status) {
      parts.push(`Status: ${composition.status}`);
    }

    if (composition.type) {
      const typeStr = formatCodeableConcepts([composition.type], "Type");
      if (typeStr) {
        parts.push(typeStr);
        hasMinimumData = true;
      }
    }

    if (composition.category) {
      const categoryStr = formatCodeableConcepts(composition.category, "Category");
      if (categoryStr) parts.push(categoryStr);
    }

    // if (composition.subject) {
    //   const subjectStr = formatReferences([composition.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    if (composition.date) {
      parts.push(`Date: ${composition.date}`);
    }

    if (composition.author) {
      const authorStr = formatReferences(composition.author, "Author");
      if (authorStr) parts.push(authorStr);
    }

    if (composition.attester) {
      const attestations = composition.attester
        .map(attester => {
          const mode = attester.mode ? `Mode: ${attester.mode}` : undefined;
          const time = attester.time ? `Time: ${attester.time}` : undefined;
          const party = attester.party ? formatReferences([attester.party], "Party") : undefined;
          return [mode, time, party].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (attestations.length > 0) {
        parts.push(`Attestations: ${attestations.join(FIELD_SEPARATOR)}`);
        // hasMinimumData = true;
      }
    }

    if (composition.custodian) {
      const custodianStr = formatReferences([composition.custodian], "Custodian");
      if (custodianStr) parts.push(custodianStr);
    }

    if (composition.title) {
      parts.push(`Title: ${composition.title}`);
      hasMinimumData = true;
    }

    // if (composition.confidentiality) {
    //   parts.push(`Confidentiality: ${composition.confidentiality}`);
    // }

    if (composition.event) {
      const eventStr = composition.event
        .map(event => {
          const code = event.code ? `Code: ${event.code}` : undefined;
          const period = formatPeriod(event.period);
          return [code, period].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (eventStr) parts.push(`Service: ${eventStr.join(FIELD_SEPARATOR)}`);
    }

    if (composition.section) {
      const sections = composition.section
        .map((section: CompositionSection) => {
          const title = section.title ? `Title: ${section.title}` : undefined;
          const text = formatNarrative(section.text, "Text");
          return [title, text].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (sections.length > 0) {
        parts.push(`Sections: ${sections.join(FIELD_SEPARATOR)}`);
      }
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
