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
  toString(doc: DocumentReference, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const masterIdentifierStr = formatIdentifier({ identifier: doc.masterIdentifier });
    if (masterIdentifierStr)
      parts.push(isDebug ? `Master Identifier: ${masterIdentifierStr}` : masterIdentifierStr);

    const identifierStr = formatIdentifiers({ identifiers: doc.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (doc.status) parts.push(isDebug ? `Status: ${doc.status}` : doc.status);

    if (doc.docStatus) parts.push(isDebug ? `Document Status: ${doc.docStatus}` : doc.docStatus);

    const typeStr = formatCodeableConcept({ concept: doc.type, label: "Type", isDebug });
    if (typeStr) {
      parts.push(typeStr);
    }

    const categoryStr = formatCodeableConcepts({
      concepts: doc.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    // if (doc.subject) {
    //   const subjectStr = formatReferences([doc.subject], "Subject");
    //   if (subjectStr) parts.push(subjectStr);
    // }

    if (doc.date) parts.push(isDebug ? `Date: ${doc.date}` : doc.date);

    const authorStr = formatReferences({ references: doc.author, label: "Author", isDebug });
    if (authorStr) parts.push(authorStr);

    // if (doc.authenticator) {
    //   const authenticatorStr = formatReferences({ references: [doc.authenticator], label: "Authenticator", isDebug });
    //   if (authenticatorStr) parts.push(authenticatorStr);
    // }

    // if (doc.custodian) {
    //   const custodianStr = formatReferences({ references: [doc.custodian], label: "Custodian", isDebug });
    //   if (custodianStr) parts.push(custodianStr);
    // }

    const relations = doc.relatesTo
      ?.map(rel => {
        const code = rel.code ? (isDebug ? `Code: ${rel.code}` : rel.code) : undefined;
        const target = formatReference({
          reference: rel.target,
          label: "Target",
          isDebug,
        });
        return [code, target].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (relations && relations.length > 0) {
      const relationsStr = relations.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Relations: ${relationsStr}` : relationsStr);
      hasMinimumData = true;
    }

    if (doc.description) {
      parts.push(isDebug ? `Description: ${doc.description}` : doc.description);
      hasMinimumData = true;
    }

    const securityStr = formatCodeableConcepts({
      concepts: doc.securityLabel,
      label: "Security Label",
      isDebug,
    });
    if (securityStr) parts.push(securityStr);

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

      const encounterStr = formatReferences({
        references: context.encounter,
        label: "Encounter",
        isDebug,
      });
      if (encounterStr) contextParts.push(encounterStr);

      const events = formatCodeableConcepts({ concepts: context.event, label: "Events", isDebug });
      if (events) contextParts.push(events);

      const periodStr = formatPeriod({ period: context.period, label: "Period", isDebug });
      if (periodStr) contextParts.push(periodStr);

      const facilityStr = formatCodeableConcept({
        concept: context.facilityType,
        label: "Facility Type",
        isDebug,
      });
      if (facilityStr) contextParts.push(facilityStr);

      const practiceStr = formatCodeableConcept({
        concept: context.practiceSetting,
        label: "Practice Setting",
        isDebug,
      });
      if (practiceStr) contextParts.push(practiceStr);

      // const patientStr = formatReference({ reference: context.sourcePatientInfo, label: "Source Patient", isDebug });
      // if (patientStr) contextParts.push(patientStr);

      const related = formatReferences({
        references: context.related,
        label: "Related",
        isDebug,
      });
      if (related) contextParts.push(related);

      if (contextParts.length > 0) {
        const contextStr = contextParts.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Context: ${contextStr}` : contextStr);
        hasMinimumData = true;
      }
    }

    const textStr = formatNarrative({ narrative: doc.text, label: "Text", isDebug });
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
