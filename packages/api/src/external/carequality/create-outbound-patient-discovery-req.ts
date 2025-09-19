import {
  OutboundPatientDiscoveryReq,
  XCPDGateway,
  PatientResource,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { HieInitiator } from "../hie/get-hie-initiator";
import { createPurposeOfUse, getSystemUserName } from "./shared";

export function createOutboundPatientDiscoveryReq({
  patientResource,
  cxId,
  patientId,
  xcpdGateways,
  initiator,
  requestId,
}: {
  patientResource: PatientResource;
  cxId: string;
  patientId: string;
  xcpdGateways: XCPDGateway[];
  initiator: HieInitiator;
  requestId: string;
}): OutboundPatientDiscoveryReq {
  const user = getSystemUserName(initiator.orgName);
  const id = requestId;

  return {
    id,
    cxId: cxId,
    patientId,
    timestamp: dayjs().toISOString(),
    gateways: xcpdGateways,
    principalCareProviderIds: [initiator.npi],
    samlAttributes: {
      queryGrantorOid: initiator.queryGrantorOid,
      subjectId: user,
      // TODO https://github.com/metriport/metriport/pull/1302#discussion_r1422876830
      subjectRole: {
        code: "106331006",
        display: "Administrative AND/OR managerial worker",
      },
      organization: initiator.name,
      organizationId: initiator.oid,
      homeCommunityId: initiator.oid,
      purposeOfUse: createPurposeOfUse(),
    },
    patientResource,
  };
}
