import {
  DocumentReference,
  DocumentQueryRespFromExternalGW,
  DocumentRetrievalRespFromExternalGW,
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

export type DocumentWithMetriportId = DocumentReference & {
  id: string;
  originalId: string;
};

type IHEResults = DocumentQueryRespFromExternalGW | DocumentRetrievalRespFromExternalGW;

// Create a single array of all the document references from all the document query results
export function combineDocRefs(documentQueryResults: IHEResults[]): DocumentReference[] {
  return documentQueryResults.reduce((acc: DocumentReference[], curr) => {
    const documentReferences = curr.documentReference ?? [];
    const documentReferencesWithUrl = documentReferences.map(docRef => {
      return {
        ...docRef,
        url: curr.gateway.url,
      };
    });

    return [...acc, ...documentReferencesWithUrl];
  }, []);
}

export const cqToFHIR = (
  docId: string,
  doc: IHEGWDocumentReference,
  patientId: string,
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
    ...(!fhirDocRef ? { description: doc.title ?? "" } : {}),
    id: docId,
    resourceType: "DocumentReference",
    masterIdentifier: {
      system: doc.homeCommunityId,
      value: doc.repositoryUniqueId,
    },
    subject: toFHIRSubject(patientId),
    content: generateCQFHIRContent(fhirDocRef?.content, baseAttachment, doc.url),
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
  location: string | null | undefined
): DocumentReferenceContent[] => {
  if (!location) return [];

  if (content) {
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
