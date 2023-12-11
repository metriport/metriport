import { PatientDiscoveryRequest, XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { PurposeOfUse } from "@metriport/carequality-sdk";
import { Patient as FHIRPatient } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import dayjs from "dayjs";

export function patientToIheGateway({
  patient,
  cxId,
  xcpdGateways,
  facilityNPI,
  orgName,
  orgOid,
}: {
  patient: FHIRPatient;
  cxId: string;
  xcpdGateways: XCPDGateways;
  facilityNPI: string;
  orgName: string;
  orgOid: string;
}): PatientDiscoveryRequest {
  const user = `${orgName} System User`;

  return {
    id: uuidv7(),
    cxId: cxId,
    timestamp: dayjs().toISOString(),
    xcpdGateways: xcpdGateways,
    principalCareProviderIds: [facilityNPI],
    samlAttributes: {
      subjectId: user,
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
