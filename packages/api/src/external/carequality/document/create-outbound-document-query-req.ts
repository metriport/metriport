import { Patient } from "@metriport/core/domain/patient";
import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { CQLink } from "../cq-patient-data";
import { createPurposeOfUse, getSystemUserName } from "../shared";
import { doesGatewayNeedDateRanges } from "@metriport/core/external/carequality/ihe-gateway-v2/gateways";

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
  const now = dayjs();
  const user = getSystemUserName(initiator.orgName);

  return cqLinks.flatMap(externalGateway => {
    if (doesGatewayNeedDateRanges(externalGateway.url)) {
      const requests = [];
      const length = 10;
      for (let i = 0; i < length; i++) {
        const dateTo = now.subtract(i * 6, "month").toISOString();
        const dateFrom =
          i !== length - 1
            ? now.subtract((i + 1) * 6, "month").toISOString()
            : now.subtract(25, "year").toISOString();
        requests.push({
          id: requestId,
          cxId: cxId,
          timestamp: now.toISOString(),
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
          documentCreationDate: {
            dateFrom: dateFrom,
            dateTo: dateTo,
          },
        });
      }
      return requests;
    } else {
      return [
        {
          id: requestId,
          cxId: cxId,
          timestamp: now.toISOString(),
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
          documentCreationDate: {
            dateFrom: now.toISOString(),
            dateTo: now.toISOString(),
          },
        },
      ];
    }
  });
}
