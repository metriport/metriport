import { OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { PurposeOfUse } from "@metriport/carequality-sdk";
import { Patient as FHIRPatient } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import dayjs from "dayjs";

// TODO: https://github.com/metriport/metriport/pull/1302#discussion_r1422870828
export function createPatientDiscoveryRequest({
  patient,
  cxId,
  xcpdGateways,
  facilityNPI,
  orgName,
  orgOid,
}: {
  patient: FHIRPatient;
  cxId: string;
  xcpdGateways: XCPDGateway[];
  facilityNPI: string;
  orgName: string;
  orgOid: string;
}): OutboundPatientDiscoveryReq {
  const user = `${orgName} System User`;

  return {
    id: uuidv7(),
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
      purposeOfUse: PurposeOfUse.TREATMENT,
    },
    patientResource: patient,
  };
}
