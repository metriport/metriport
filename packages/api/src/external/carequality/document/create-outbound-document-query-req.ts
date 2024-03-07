import { Organization } from "@metriport/core/domain/organization";
import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { CQLink } from "../cq-patient-data";
import { createPurposeOfUse } from "../shared";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createOutboundDocumentQueryRequests({
  requestId,
  patientId,
  cxId,
  organization,
  cqLinks,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  organization: Organization;
  cqLinks: CQLink[];
}): OutboundDocumentQueryReq[] {
  const orgOid = organization.oid;
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();

  return cqLinks.map(externalGateway => {
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
        purposeOfUse: createPurposeOfUse(),
      },
      gateway: {
        homeCommunityId: externalGateway.oid,
        url: externalGateway.url,
      },
      externalGatewayPatient: {
        id: externalGateway.patientId,
        system: externalGateway.systemId,
      },
      patientId: patientId,
    };
  });
}
