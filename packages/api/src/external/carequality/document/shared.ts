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
import { formatDate } from "../shared";

const regex = /^(.+?)\^+(.+)$/;

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
  contentExtension: MetriportDataSourceExtension,
  orgName?: string
): DocumentReferenceWithId => {
  const baseAttachment = {
    ...(docRef.fileName ? { fileName: docRef.fileName } : {}),
    ...(docRef.contentType ? { contentType: docRef.contentType } : {}),
    ...(docRef.size ? { size: docRef.size } : {}),
    ...(docRef.creation ? { creation: docRef.creation } : {}),
  };

  const contained: Resource[] = [];

  const containedResources = docRef.authorInstitution
    ? mapToContainedOrganization(docRef.authorInstitution)
    : mapToContainedOrganization(orgName);
  if (containedResources) contained.push(containedResources);

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
    contained: contained.length ? contained : undefined,
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

function mapToContainedOrganization(
  authorInstitution: string | undefined
): Organization | undefined {
  if (!authorInstitution) return;

  const org = splitNameAndOid(authorInstitution);
  if (!org) return generateOrganization(authorInstitution);
  const organization = org.name ? generateOrganization(org.name, org.oid) : undefined;

  return organization;
}

export function generateOrganization(name: string, oid?: string) {
  const organization: Organization = {
    resourceType: "Organization",
  };
  organization.name = name;
  if (oid) {
    organization.identifier = [
      {
        value: oid,
      },
    ];
  }
  return organization;
}

function splitNameAndOid(
  input: string
): { name: string | undefined; oid: string | undefined } | undefined {
  const match = input.match(regex);

  if (match && match.length === 3) {
    return { name: match[1], oid: match[2] };
  }

  return undefined;
}
