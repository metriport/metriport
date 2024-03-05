import { DocumentReferenceContent } from "@medplum/fhirtypes";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/index";
import {
  DocumentReference,
  DocumentReference as IHEGWDocumentReference,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { cqExtension } from "@metriport/core/external/carequality/extension";
import { MetriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { createDocReferenceContent, DocumentReferenceWithId } from "../../fhir/document";

export type DocumentReferenceWithMetriportId = DocumentReference & {
  metriportId: string;
};

type IHEResults = OutboundDocumentQueryResp | OutboundDocumentRetrievalResp;

export function containsMetriportId(
  docRef: IHEGWDocumentReference
): docRef is DocumentReferenceWithMetriportId {
  return docRef.metriportId != undefined;
}

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
  docRef: IHEGWDocumentReference,
  docStatus: "preliminary" | "final",
  patientId: string,
  contentExtension: MetriportDataSourceExtension
): DocumentReferenceWithId => {
  const baseAttachment = {
    ...(docRef.fileName ? { fileName: docRef.fileName } : {}),
    ...(docRef.contentType ? { contentType: docRef.contentType } : {}),
    ...(docRef.size ? { size: docRef.size } : {}),
    ...(docRef.creation ? { creation: docRef.creation } : {}),
  };

  const updatedDocRef: DocumentReferenceWithId = {
    id: docId,
    resourceType: "DocumentReference",
    masterIdentifier: {
      system: docRef.homeCommunityId,
      value: docId,
    },
    docStatus,
    subject: toFHIRSubject(patientId),
    content: generateCQFHIRContent(baseAttachment, contentExtension, docRef.url),
    extension: [cqExtension],
  };
  if (docRef.title) updatedDocRef.description = docRef.title;

  return updatedDocRef;
};

const generateCQFHIRContent = (
  baseAttachment: {
    contentType?: string;
    size?: number;
    creation?: string;
    fileName?: string;
  },
  contentExtension: MetriportDataSourceExtension,
  location: string | null | undefined
): DocumentReferenceContent[] => {
  if (!location) return [];

  const cqFHIRContent = createDocReferenceContent({
    ...baseAttachment,
    location: location,
    extension: [contentExtension],
  });

  return [cqFHIRContent];
};
