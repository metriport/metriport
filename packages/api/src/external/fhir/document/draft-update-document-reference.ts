import {
  Attachment,
  DocumentReference,
  DocumentReferenceContent,
  Organization,
} from "@medplum/fhirtypes";
import { createFHIRSubject } from ".";
import BadRequestError from "../../../errors/bad-request";
import { OrganizationModel } from "../../../models/medical/organization";
import { metriportDataSourceExtension } from "../shared/extensions/metriport";

export function docRefCheck(docRef: DocumentReference) {
  if (!docRef.description) throw new BadRequestError(`Document Reference must have a description`);
  if (!docRef.type) throw new BadRequestError(`Document Reference must have a type`);
  if (!docRef.context) throw new BadRequestError(`Document Reference must have context`);
}

export function pickDocRefParts(
  prelimDocRef: DocumentReference,
  organization: OrganizationModel,
  docRefId: string,
  patientId: string,
  s3Key: string,
  bucketName: string
): DocumentReference {
  const containedOrg: Organization = {
    resourceType: "Organization",
    id: organization.id, //internal uuid
    identifier: [{ value: organization.dataValues.organizationNumber.toString() }], // make this use oid
    name: organization.dataValues.data.name,
  };
  const temporaryExtension = metriportDataSourceExtension;
  temporaryExtension.valueCoding.code = "TEMPORARY";

  const subject = createFHIRSubject(patientId);

  const attachment: Attachment = {
    title: "pre-upload placeholder",
    url: `s3://${bucketName}/${s3Key}`,
  };

  const content: DocumentReferenceContent[] = [{ attachment }];

  return {
    resourceType: "DocumentReference",
    id: docRefId,
    contained: prelimDocRef.contained ? [...prelimDocRef.contained, containedOrg] : [containedOrg],
    status: "current",
    docStatus: "preliminary",
    text: prelimDocRef.text ?? undefined,
    extension: prelimDocRef.extension
      ? [...prelimDocRef.extension, temporaryExtension]
      : [temporaryExtension],
    type: prelimDocRef.type,
    category: prelimDocRef.category ?? undefined,
    date: prelimDocRef.date ?? new Date().toISOString(),
    author: prelimDocRef.author ?? undefined,
    subject,
    description: prelimDocRef.description,
    context: prelimDocRef.context,
    content,
  };
}
