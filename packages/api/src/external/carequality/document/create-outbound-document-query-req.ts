import { Patient } from "@metriport/core/domain/patient";
import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { CQLink } from "../cq-patient-data";
import { createPurposeOfUse, getCqInitiator, getSystemUserName } from "../shared";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export async function createOutboundDocumentQueryRequests({
  requestId,
  patient,
  cxId,
  cqLinks,
}: {
  requestId: string;
  patient: Patient;
  cxId: string;
  cqLinks: CQLink[];
}): Promise<OutboundDocumentQueryReq[]> {
  const now = dayjs().toISOString();
  const initiator = await getCqInitiator(patient);
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
