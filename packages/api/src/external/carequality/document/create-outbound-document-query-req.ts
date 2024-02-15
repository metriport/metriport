import { PurposeOfUse } from "@metriport/shared";
import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { Organization } from "@metriport/core/domain/organization";
import { CQLink } from "../cq-patient-data";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createOutboundDocumentQueryRequests({
  requestId,
  cxId,
  organization,
  cqLinks,
}: {
  requestId: string;
  cxId: string;
  organization: Organization;
  cqLinks: CQLink[];
}): OutboundDocumentQueryReq[] {
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
        purposeOfUse: PurposeOfUse.TREATMENT,
      },
      gateway: {
        homeCommunityId: systemId,
        url: url,
      },
      externalGatewayPatient: {
        id: patientId,
        system: systemId,
      },
      patientId: patientId,
    };
  });
}
