import {
  Attachment,
  DocumentReference,
  DocumentReferenceContent,
  Extension,
  Identifier,
  Resource,
} from "@medplum/fhirtypes";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/index";
import { IETF_URL } from "@metriport/core/external/fhir/shared/namespaces";
import BadRequestError from "@metriport/core/util/error/bad-request";
import { cloneDeep } from "lodash";
import { OrganizationModel } from "../../../models/medical/organization";
import { Config } from "../../../shared/config";
import { TEMPORARY } from "../../../shared/constants";
import { appendIdentifierOID, toFHIR } from "../organization";
import { metriportDataSourceExtension } from "../shared/extensions/metriport";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

const temporaryExtension = cloneDeep(metriportDataSourceExtension);
temporaryExtension.valueCoding.code = TEMPORARY;

export function docRefCheck(docRef: DocumentReference) {
  if (!docRef.description) throw new BadRequestError(`Document Reference must have a description`);
  if (!docRef.type) throw new BadRequestError(`Document Reference must have a type`);
  if (!docRef.context) throw new BadRequestError(`Document Reference must have context`);
}

/**
 * Create a Document Reference with a temporary status and a placeholder attachment
 * to be used during the upload process.
 */
export function composeDocumentReference({
  inputDocRef,
  organization,
  patientId,
  docRefId,
  s3Key,
  s3BucketName,
}: {
  inputDocRef: DocumentReference;
  organization: OrganizationModel;
  patientId: string;
  docRefId: string;
  s3Key: string;
  s3BucketName: string;
}): DocumentReference {
  const masterIdentifier = getMasterIdentifier(docRefId);
  const identifier = getIdentifiers(inputDocRef);
  const contained = getContained(inputDocRef, organization);
  const extension = getExtensions(inputDocRef);
  const subject = toFHIRSubject(patientId);
  const content = getContent(s3Key, s3BucketName);
  return {
    resourceType: "DocumentReference",
    id: docRefId,
    masterIdentifier,
    identifier,
    contained,
    status: "current",
    docStatus: "preliminary",
    text: inputDocRef.text,
    extension,
    type: inputDocRef.type,
    category: inputDocRef.category ?? undefined,
    date: inputDocRef.date ?? new Date().toISOString(),
    author: inputDocRef.author,
    subject,
    description: inputDocRef.description,
    context: inputDocRef.context,
    content,
  };
}

function getMasterIdentifier(docRefId: string): Identifier {
  return {
    system: IETF_URL,
    value: docRefId,
  };
}

function getIdentifiers(inputDocRef: DocumentReference): Identifier[] {
  return [
    ...(inputDocRef.masterIdentifier ? [inputDocRef.masterIdentifier] : []),
    ...(inputDocRef.identifier ?? []),
  ];
}

function getContained(inputDocRef: DocumentReference, organization: OrganizationModel): Resource[] {
  const containedOrg = toFHIR(organization);
  const containedOrgWithOID = appendIdentifierOID(organization, containedOrg);
  return inputDocRef.contained
    ? [...inputDocRef.contained, containedOrgWithOID]
    : [containedOrgWithOID];
}

function getExtensions(inputDocRef: DocumentReference): Identifier[] {
  if (!inputDocRef.extension) return [temporaryExtension];
  const allowedExtensions = inputDocRef.extension.filter(isAllowedExtension);
  return [...allowedExtensions, temporaryExtension];
}

function isAllowedExtension(e: Extension): boolean {
  if (e.url && e.url.toUpperCase().includes(metriportDataSourceExtension.url)) return false;

  if (!e.valueCoding) return true;

  const system = e.valueCoding.system;
  if (system && system.toUpperCase().includes(metriportDataSourceExtension.valueCoding.code)) {
    return false;
  }
  return e.valueCoding.code !== metriportDataSourceExtension.valueCoding.code;
}

function getContent(s3Key: string, s3BucketName: string): DocumentReferenceContent[] {
  const attachment: Attachment = {
    title: "pre-upload placeholder",
    url: s3Utils.buildFileUrl(s3BucketName, s3Key),
  };
  const content: DocumentReferenceContent[] = [{ attachment }];
  return content;
}
