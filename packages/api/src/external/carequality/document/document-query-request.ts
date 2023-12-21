import { PurposeOfUse } from "@metriport/shared";
import { DocumentQueryRequest } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { Organization } from "../../../domain/medical/organization";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createCQDocumentQueryRequest({
  requestId,
  cxId,
  organization,
  cqLinks,
}: {
  requestId: string;
  cxId: string;
  organization: Organization;
  // WILL REPLACE WITH RAMILS TYPES
  cqLinks: {
    patientId: string;
    systemId: string;
    oid: string;
    url: string;
  }[];
}): DocumentQueryRequest[] {
  const orgOid = organization.oid;
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();

  return cqLinks.map(cqLink => {
    const { patientId, systemId, url } = cqLink;

    return {
      id: requestId,
      cxId: cxId,
      timestamp: now,
      samlAttributes: {
        subjectId: user,
        subjectRole: {
          code: SUBJECT_ROLE_CODE,
          display: SUBJECT_ROLE_DISPLAY,
        },
        organization: orgName,
        organizationId: orgOid,
        homeCommunityId: orgOid,
        // TODO: UPDATE
        purposeOfUse: PurposeOfUse.TREATMENT,
      },
      gateway: {
        homeCommunityId: systemId,
        url: url,
      },
      xcpdPatientId: {
        id: patientId,
        system: systemId,
      },
      patientId: patientId,
    };
  });
}
