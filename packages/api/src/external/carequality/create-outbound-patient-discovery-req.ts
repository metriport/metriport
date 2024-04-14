import { OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { Patient as FHIRPatient } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { createPurposeOfUse } from "./shared";

export function createOutboundPatientDiscoveryReq({
  patient,
  cxId,
  xcpdGateways,
  facilityNPI,
  orgName,
  orgOid,
  requestId,
}: {
  patient: FHIRPatient;
  cxId: string;
  xcpdGateways: XCPDGateway[];
  facilityNPI: string;
  orgName: string;
  orgOid: string;
  requestId: string;
}): OutboundPatientDiscoveryReq {
  const user = `${orgName} System User`;
  const id = requestId;

  return {
    id,
    cxId: cxId,
    timestamp: dayjs().toISOString(),
    gateways: xcpdGateways,
    principalCareProviderIds: [facilityNPI],
    samlAttributes: {
      subjectId: user,
      // TODO https://github.com/metriport/metriport/pull/1302#discussion_r1422876830
      subjectRole: {
        code: "106331006",
        display: "Administrative AND/OR managerial worker",
      },
      organization: orgName,
      organizationId: orgOid,
      homeCommunityId: orgOid,
      purposeOfUse: createPurposeOfUse(),
    },
    patientResource: patient,
  };
}
