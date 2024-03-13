import { DocumentReferenceContent, Organization, Resource } from "@medplum/fhirtypes";
import { cqExtension } from "@metriport/core/external/carequality/extension";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/index";
import { MetriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import {
  DocumentReference,
  DocumentReference as IHEGWDocumentReference,
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { DocumentReferenceWithId, createDocReferenceContent } from "../../fhir/document";

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
  const docRefs = documentReferences.map(docRef => {
    return {
      ...docRef,
      url: documentQueryResult.gateway.url,
    };
  });
  return docRefs;
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

  const containedResources = generateCQFHIRContained(docRef);
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
    contained: containedResources,
    date: docRef.date ? formatDate(docRef.date) : undefined,
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

const generateCQFHIRContained = (docRef: IHEGWDocumentReference): Resource[] => {
  if (!docRef.authorInstitution) return [];

  const org = splitNameAndOid(docRef.authorInstitution);
  if (!org) return [];
  const organization: Organization = {
    resourceType: "Organization",
  };
  if (org.name) organization.name = org.name;
  if (org.oid) {
    organization.identifier = [
      {
        value: org.oid,
      },
    ];
  }

  return [organization];
};

function splitNameAndOid(
  input: string
): { name: string | undefined; oid: string | undefined } | undefined {
  const regex = /^(.+?)\^+(.+)$/;
  const match = input.match(regex);

  if (match && match.length === 3) {
    return { name: match[1], oid: match[2] };
  }

  return undefined;
}

export function formatDate(dateString: string | undefined): string | undefined {
  if (!dateString) return undefined;
  const preprocessedDate = dateString.replace(/[-:]/g, "");
  const year = preprocessedDate.slice(0, 4);
  const month = preprocessedDate.slice(4, 6);
  const day = preprocessedDate.slice(6, 8);
  const formattedDate = `${year}-${month}-${day}`;

  try {
    const date = new Date(formattedDate);
    return date.toISOString();
  } catch (error) {
    const msg = "Error creating date object for document reference";
    console.log(`${msg}: ${error}`);
  }

  return undefined;
}
