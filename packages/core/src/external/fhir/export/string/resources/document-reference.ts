import { DocumentReference } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifier, formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR DocumentReference resource to a string representation
 */
export class DocumentReferenceToString implements FHIRResourceToString<DocumentReference> {
  toString(doc: DocumentReference): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const masterIdentifierStr = formatIdentifier(doc.masterIdentifier);
    if (masterIdentifierStr) parts.push(`Master Identifier: ${masterIdentifierStr}`);

    if (doc.identifier) {
      const identifierStr = formatIdentifiers(doc.identifier);
      if (identifierStr) parts.push(identifierStr);
    }

    if (doc.status) {
      parts.push(`Status: ${doc.status}`);
    }

    if (doc.docStatus) parts.push(`Document Status: ${doc.docStatus}`);

    if (doc.type) {
      const typeStr = formatCodeableConcepts([doc.type], "Type");
      if (typeStr) {
        parts.push(typeStr);
        // hasMinimumData = true;
      }
    }

    if (doc.category) {
      const categoryStr = formatCodeableConcepts(doc.category, "Category");
      if (categoryStr) {
        parts.push(categoryStr);
        // hasMinimumData = true;
      }
    }

    // if (doc.subject) {
    //   const subjectStr = formatReferences([doc.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    if (doc.date) {
      parts.push(`Date: ${doc.date}`);
    }

    if (doc.author) {
      const authorStr = formatReferences(doc.author, "Author");
      if (authorStr) parts.push(authorStr);
    }

    // if (doc.authenticator) {
    //   const authenticatorStr = formatReferences([doc.authenticator], "Authenticator");
    //   if (authenticatorStr) parts.push(authenticatorStr);
    // }

    // if (doc.custodian) {
    //   const custodianStr = formatReferences([doc.custodian], "Custodian");
    //   if (custodianStr) parts.push(custodianStr);
    // }

    if (doc.relatesTo) {
      const relations = doc.relatesTo
        .map(rel => {
          const code = rel.code ? `Code: ${rel.code}` : undefined;
          const target = formatReference(rel.target, "Target");
          return [code, target].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (relations.length > 0) {
        parts.push(`Relations: ${relations.join(FIELD_SEPARATOR)}`);
        // hasMinimumData = true;
      }
    }

    if (doc.description) {
      parts.push(`Description: ${doc.description}`);
      hasMinimumData = true;
    }

    if (doc.securityLabel) {
      const securityStr = formatCodeableConcepts(doc.securityLabel, "Security Label");
      if (securityStr) parts.push(securityStr);
    }

    // if (doc.content) {
    //   const contents = doc.content
    //     .map((content: DocumentReferenceContent) => {
    //       const components = [
    //         content.attachment && formatAttachment(content.attachment),
    //         formatCoding(content.format),
    //       ].filter(Boolean);
    //       return components.join(FIELD_SEPARATOR);
    //     })
    //     .filter(Boolean);

    //   if (contents.length > 0) {
    //     parts.push(`Contents: ${contents.join(FIELD_SEPARATOR)}`);
    //     hasMinimumData = true;
    //   }
    // }

    if (doc.context) {
      const context = doc.context;
      const contextParts = [];

      if (context.encounter) {
        const encounterStr = formatReferences(context.encounter, "Encounter");
        if (encounterStr) contextParts.push(encounterStr);
      }

      const events = formatCodeableConcepts(context.event, "Events");
      if (events) contextParts.push(events);

      const periodStr = formatPeriod(context.period, "Period");
      if (periodStr) contextParts.push(periodStr);

      const facilityStr = formatCodeableConcept(context.facilityType, "Facility Type");
      if (facilityStr) contextParts.push(facilityStr);

      const practiceStr = formatCodeableConcept(context.practiceSetting, "Practice Setting");
      if (practiceStr) contextParts.push(practiceStr);

      // const patientStr = formatReference(context.sourcePatientInfo, "Source Patient");
      // if (patientStr) contextParts.push(patientStr);

      if (context.related) {
        const related = formatReferences(context.related, "Related");
        if (related) contextParts.push(related);
      }

      if (contextParts.length > 0) {
        parts.push(`Context: ${contextParts.join(FIELD_SEPARATOR)}`);
      }
    }

    const textStr = formatNarrative(doc.text, "Text");
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
