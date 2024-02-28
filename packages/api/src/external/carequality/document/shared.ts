import { DocumentReferenceContent } from "@medplum/fhirtypes";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/index";
import {
  DocumentReference,
  DocumentReference as IHEGWDocumentReference,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { cqExtension } from "../../carequality/extension";
import { createDocReferenceContent, DocumentReferenceWithId } from "../../fhir/document";
import { DataSourceExtension } from "../../fhir/shared/extensions/metriport";

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
  contentExtension: DataSourceExtension
): DocumentReferenceWithId => {
  const baseAttachment = {
    ...(docRef.fileName ? { fileName: docRef.fileName } : {}),
    ...(docRef.contentType ? { contentType: docRef.contentType } : {}),
    ...(docRef.size ? { size: docRef.size } : {}),
    ...(docRef.creation ? { creation: docRef.creation } : {}),
  };

  return {
    id: docId,
    resourceType: "DocumentReference",
    masterIdentifier: {
      system: docRef.homeCommunityId,
      value: docId,
    },
    description: docRef.title ?? undefined,
    docStatus,
    subject: toFHIRSubject(patientId),
    content: generateCQFHIRContent(baseAttachment, contentExtension, docRef.url),
    extension: [cqExtension],
  };
};

const generateCQFHIRContent = (
  baseAttachment: {
    contentType?: string;
    size?: number;
    creation?: string;
    fileName?: string;
  },
  contentExtension: DataSourceExtension,
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
