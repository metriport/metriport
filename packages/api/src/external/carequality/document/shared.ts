import {
  DocumentReference,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
  DocumentReference as IHEGWDocumentReference,
} from "@metriport/ihe-gateway-sdk";
import {
  DocumentReference as DocumentReferenceFHIR,
  DocumentReferenceContent,
} from "@medplum/fhirtypes";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/index";
import { cqExtension } from "../../carequality/extension";
import { DocumentReferenceWithId, createDocReferenceContent } from "../../fhir/document";
import { metriportDataSourceExtension } from "../../fhir/shared/extensions/metriport";

export type DocumentReferenceWithMetriportId = DocumentReference & {
  id: string;
};

type IHEResults = OutboundDocumentQueryResp | OutboundDocumentRetrievalResp;

/**
 * Converts the IHE Gateway results to a IHE DocumentReference Schema
 */
export function toDocumentReference(documentQueryResult: IHEResults): DocumentReference[] {
  const documentReferences = documentQueryResult.documentReference ?? [];

  return documentReferences.map(docRef => {
    return {
      ...docRef,
      url: documentQueryResult.gateway.url,
    };
  });
}

export const cqToFHIR = (
  docId: string,
  doc: IHEGWDocumentReference,
  patientId: string,
  hasMetriportContent: boolean,
  fhirDocRef?: DocumentReferenceFHIR
): DocumentReferenceWithId => {
  const baseAttachment = {
    ...(doc.fileName ? { fileName: doc.fileName } : {}),
    ...(doc.contentType ? { contentType: doc.contentType } : {}),
    ...(doc.size ? { size: doc.size } : {}),
    ...(doc.creation ? { creation: doc.creation } : {}),
  };

  return {
    ...(fhirDocRef ? { ...fhirDocRef } : {}),
    ...(!fhirDocRef ? { description: doc.title ?? undefined } : {}),
    id: docId,
    resourceType: "DocumentReference",
    masterIdentifier: {
      system: doc.homeCommunityId,
      value: docId,
    },
    subject: toFHIRSubject(patientId),
    content: generateCQFHIRContent(
      fhirDocRef?.content,
      baseAttachment,
      hasMetriportContent,
      doc.url
    ),
    extension: [cqExtension],
  };
};

const generateCQFHIRContent = (
  content: DocumentReferenceContent[] | undefined,
  baseAttachment: {
    contentType?: string;
    size?: number;
    creation?: string;
    fileName?: string;
  },
  hasMetriportContent: boolean,
  location: string | null | undefined
): DocumentReferenceContent[] => {
  if (!location) return [];

  if (hasMetriportContent && content) {
    const metriportFHIRContent = createDocReferenceContent({
      ...baseAttachment,
      location: location,
      extension: [metriportDataSourceExtension],
    });

    return [...content, metriportFHIRContent];
  }

  const cqFHIRContent = createDocReferenceContent({
    ...baseAttachment,
    location: location,
    extension: [cqExtension],
  });

  return [cqFHIRContent];
};
