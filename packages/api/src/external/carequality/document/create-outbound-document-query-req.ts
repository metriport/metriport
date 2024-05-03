import { Patient } from "@metriport/core/domain/patient";
import { OutboundDocumentQueryReq } from "@metriport/core/external/carequality/ihe-gateway-types";
import dayjs from "dayjs";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { CQLink } from "../cq-patient-data";
import { createPurposeOfUse, getSystemUserName } from "../shared";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createOutboundDocumentQueryRequests({
  requestId,
  patient,
  initiator,
  cxId,
  cqLinks,
}: {
  requestId: string;
  patient: Patient;
  initiator: HieInitiator;
  cxId: string;
  cqLinks: CQLink[];
}): OutboundDocumentQueryReq[] {
  const now = dayjs().toISOString();
  const user = getSystemUserName(initiator.orgName);

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
        organization: initiator.name,
        organizationId: initiator.oid,
        homeCommunityId: initiator.oid,
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
      patientId: patient.id,
    };
  });
}
