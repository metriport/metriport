import { DocumentReferenceContent, Organization, Resource } from "@medplum/fhirtypes";
import { cqExtension } from "@metriport/core/external/carequality/extension";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/conversion";
import { MetriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import {
  DocumentReference,
  DocumentReference as IHEGWDocumentReference,
  type Coding,
} from "@metriport/ihe-gateway-sdk";
import { DocumentReferenceWithId, createDocReferenceContent } from "../../fhir/document";
import { formatDate } from "../shared";

const regex = /^(.+?)\^+(.+)$/;

export type DocumentReferenceWithMetriportId = DocumentReference & {
  metriportId: string;
};

export function containsMetriportId(
  docRef: IHEGWDocumentReference
): docRef is DocumentReferenceWithMetriportId {
  return docRef.metriportId != undefined;
}

export function containsDuplicateMetriportId(
  docRef: DocumentReferenceWithMetriportId,
  seenMetriportIds: Set<string>
): boolean {
  if (seenMetriportIds.has(docRef.metriportId)) {
    return true;
  } else {
    seenMetriportIds.add(docRef.metriportId);
    return false;
  }
}

// eslint-disable-next-line @metriport/eslint-rules/no-named-arrow-functions
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
    ...(docRef.formatCoding ? { format: docRef.formatCoding } : {}),
  };

  const context = {
    ...(docRef.serviceStartTime || docRef.serviceStopTime
      ? {
          period: {
            start: formatDate(docRef.serviceStartTime),
            end: formatDate(docRef.serviceStopTime),
          },
        }
      : {}),
    ...(docRef.healthcareFacilityTypeCoding
      ? { facilityType: { coding: [docRef.healthcareFacilityTypeCoding] } }
      : {}),
    ...(docRef.practiceSettingCoding
      ? { practiceSetting: { coding: [docRef.practiceSettingCoding] } }
      : {}),
  };

  const contained: Resource[] = [];

  if (docRef.authorInstitution) {
    const organizationFromDocRef = mapToContainedOrganization(docRef.authorInstitution);
    if (organizationFromDocRef) contained.push(organizationFromDocRef);
  }
  const organizationFromCqDirectory = mapToContainedOrganization(orgName);
  if (organizationFromCqDirectory) contained.push(organizationFromCqDirectory);

  const updatedDocRef: DocumentReferenceWithId = {
    id: docId,
    resourceType: "DocumentReference",
    masterIdentifier: {
      system: docRef.homeCommunityId,
      value: docId,
    },
    docStatus,
    ...(docRef.typeCoding ? { type: { coding: [docRef.typeCoding] } } : {}),
    ...(docRef.classCoding ? { category: [{ coding: [docRef.classCoding] }] } : {}),
    status: "current",
    subject: toFHIRSubject(patientId),
    ...(docRef.confidentialityCoding
      ? { securityLabel: [{ coding: [docRef.confidentialityCoding] }] }
      : {}),
    content: generateCQFHIRContent(baseAttachment, contentExtension, docRef.url),
    extension: [cqExtension],
    contained: dedupeContainedResources(contained),
    context,
    ...(docRef.creation ? { date: formatDate(docRef.creation) } : {}),
    // TODO(ENG-1316): Add authorPerson + authorInstitution reference
    // we have the data but don't create the reference given we only store docrefs in the FHIR server right now.
  };
  if (docRef.title) updatedDocRef.description = docRef.title;

  return updatedDocRef;
};

function generateCQFHIRContent(
  baseAttachment: {
    contentType?: string;
    size?: number;
    creation?: string;
    fileName?: string;
    format?: Coding;
  },
  contentExtension: MetriportDataSourceExtension,
  location: string | null | undefined
): DocumentReferenceContent[] {
  if (!location) return [];

  const cqFHIRContent = createDocReferenceContent({
    ...baseAttachment,
    location: location,
    extension: [contentExtension],
  });

  return [cqFHIRContent];
}

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

export function dedupeContainedResources(combined: Resource[]): Resource[] | undefined {
  const seen = new Set();
  const deduped = combined.filter(resource => {
    const resourceStr = JSON.stringify(resource);
    if (!seen.has(resourceStr)) {
      seen.add(resourceStr);
      return true;
    }
    return false;
  });

  return deduped;
}

export function getContentTypeOrUnknown(docRef: DocumentReference) {
  return docRef.contentType ?? "unknown";
}
