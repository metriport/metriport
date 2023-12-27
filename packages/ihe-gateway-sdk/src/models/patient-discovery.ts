import { Patient } from "@medplum/fhirtypes";
import { NPIStringArray, BaseResponse, BaseErrorResponse, BaseRequest } from "./shared";

export type XCPDGateway = {
  oid: string;
  url: string;
  id?: string;
};
export type XCPDGateways = XCPDGateway[];

export type PatientDiscoveryRequestOutgoing = BaseRequest & {
  cxId: string;
  gateways: XCPDGateways;
  patientResource: Patient;
  principalCareProviderIds?: NPIStringArray;
};

export type PatientDiscoveryResponseIncoming =
  | (BaseResponse | BaseErrorResponse) & {
      isError: boolean;
      patientMatch: boolean;
      gateway: XCPDGateway;
      gatewayHomeCommunityId?: string;
    };

export type PatientDiscoveryRequestIncoming = BaseRequest & {
  patientResource: Patient;
};

export type PatientDiscoveryResponseOutgoing =
  | (BaseResponse & {
      patientMatch: boolean;
      xcpdHomeCommunityId: string;
      patientResource: Patient;
    })
  | (BaseErrorResponse & {
      patientMatch: boolean;
      xcpdHomeCommunityId: string;
    });
