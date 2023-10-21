import { DocumentReference, Organization } from "@medplum/fhirtypes";
import BadRequestError from "../../../errors/bad-request";
import { OrganizationModel } from "../../../models/medical/organization";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { metriportDataSourceExtension } from "../shared/extensions/metriport";

export function cxDocRefCheck(prelimDocRef: DocumentReference) {
  if (!prelimDocRef.description)
    throw new BadRequestError(`Document Reference must have a description`);
}

export function pickDocRefParts(
  prelimDocRef: DocumentReference,
  organization: OrganizationModel
): DocumentReference {
  console.log("PRELIMINARY DOC REF:", prelimDocRef);
  const docRefId = uuidv7();
  const containedOrg: Organization = {
    resourceType: "Organization",
    identifier: [{ value: organization.dataValues.organizationNumber.toString() }],
    name: organization.dataValues.data.name,
  };
  const temporaryExtension = metriportDataSourceExtension;
  temporaryExtension.valueCoding.code = "TEMPORARY";

  return {
    contained: prelimDocRef.contained ? [...prelimDocRef.contained, containedOrg] : [containedOrg],
    text: prelimDocRef.text ?? undefined,
    resourceType: "DocumentReference",
    id: docRefId,
    status: "current",
    docStatus: "preliminary",
    extension: [temporaryExtension],
    type: prelimDocRef.type ?? undefined,
    category: prelimDocRef.category ?? undefined,
    date: prelimDocRef.date ?? new Date().toISOString(),
    author: prelimDocRef.author ?? undefined,
    custodian: prelimDocRef.custodian ?? undefined,
    description: prelimDocRef.description ?? undefined,
    context: prelimDocRef.context ?? undefined,
  };
}
