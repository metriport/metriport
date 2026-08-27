import { defaultSubjectRole } from "@metriport/core/external/ehex/ehex-gateway/shared";
import {
  OutboundPatientDiscoveryReq,
  PatientResource,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { HieInitiator } from "../hie/get-hie-initiator";
import { createPurposeOfUse, getEhexSystemUserName } from "./shared";

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
  const user = getEhexSystemUserName(initiator.orgName);
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
      subjectRole: defaultSubjectRole,
      organization: initiator.name,
      organizationId: initiator.oid,
      homeCommunityId: initiator.oid,
      purposeOfUse: createPurposeOfUse(),
    },
    patientResource,
  };
}
