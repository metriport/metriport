import { defaultSubjectRole } from "@metriport/core/external/carequality/ihe-gateway-v2/shared";
import {
  OutboundPatientDiscoveryReq,
  PatientResource,
  XCPDGateway,
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
      subjectRole: defaultSubjectRole,
      organization: initiator.name,
      organizationId: initiator.oid,
      homeCommunityId: initiator.oid,
      purposeOfUse: createPurposeOfUse(),
    },
    patientResource,
  };
}
