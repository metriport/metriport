import { Attachment, DocumentReference, DocumentReferenceContent } from "@medplum/fhirtypes";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/index";
import BadRequestError from "../../../errors/bad-request";
import { OrganizationModel } from "../../../models/medical/organization";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { Config } from "../../../shared/config";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { appendIdentifierOID, toFHIR } from "../organization";
import { TEMPORARY } from "../../../shared/constants";
import { cloneDeep } from "lodash";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);

export function docRefCheck(docRef: DocumentReference) {
  if (!docRef.description) throw new BadRequestError(`Document Reference must have a description`);
  if (!docRef.type) throw new BadRequestError(`Document Reference must have a type`);
  if (!docRef.context) throw new BadRequestError(`Document Reference must have context`);
}

/**
 *
 * @param prelimDocRef
 * @param organization
 * @param patientId
 * @param docRefId
 * @param s3Key
 * @param bucketName
 * @returns
 */
export function composeDocumentReference(
  prelimDocRef: DocumentReference,
  organization: OrganizationModel,
  patientId: string,
  docRefId: string,
  s3Key: string,
  bucketName: string
): DocumentReference {
  const containedOrg = toFHIR(organization);
  const containedOrgWithOID = appendIdentifierOID(organization, containedOrg);
  const temporaryExtension = cloneDeep(metriportDataSourceExtension);
  temporaryExtension.valueCoding.code = TEMPORARY;

  const subject = toFHIRSubject(patientId);

  const attachment: Attachment = {
    title: "pre-upload placeholder",
    url: s3Utils.buildFileUrl(bucketName, s3Key),
  };

  const content: DocumentReferenceContent[] = [{ attachment }];

  return {
    resourceType: "DocumentReference",
    id: docRefId,
    contained: prelimDocRef.contained
      ? [...prelimDocRef.contained, containedOrgWithOID]
      : [containedOrgWithOID],
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
