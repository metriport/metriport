import { Patient } from "@medplum/fhirtypes";
import { NPIStringArray, BaseResponse, BaseRequest } from "./shared";

export type XCPDGateway = {
  oid: string;
  url: string;
  id?: string;
};
export type XCPDGateways = XCPDGateway[];

// The following are for us crating a patient discovery request
export type PatientDiscoveryRequestOutgoing = BaseRequest & {
  cxId: string;
  gateways: XCPDGateways;
  patientResource: Patient;
  principalCareProviderIds?: NPIStringArray;
};

export type PatientDiscoveryResponseIncoming = BaseResponse & {
  patientMatch: boolean;
  gateway: XCPDGateway;
  gatewayHomeCommunityId?: string;
};

// The following are for us receiving a patient discovery request

export type PatientDiscoveryRequestIncoming = BaseRequest & {
  patientResource: Patient;
};

export type PatientDiscoveryResponseOutgoing = BaseResponse & {
  patientMatch: boolean;
  xcpdHomeCommunityId: string;
  patientResource?: Patient;
};
