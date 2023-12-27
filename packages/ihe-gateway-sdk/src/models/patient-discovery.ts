import { Patient } from "@medplum/fhirtypes";
import {
  NPIStringArray,
  BaseResponse,
  baseResponseSchema,
  BaseErrorResponse,
  baseErrorResponseSchema,
  BaseRequest,
} from "./shared";
import * as z from "zod";

const XCPDGatewaySchema = z.object({
  oid: z.string(),
  url: z.string(),
  id: z.string().optional(),
});
export type XCPDGateway = z.infer<typeof XCPDGatewaySchema>;

export type XCPDGateways = XCPDGateway[];

export type PatientDiscoveryRequestOutgoing = BaseRequest & {
  cxId: string;
  gateways: XCPDGateways;
  patientResource: Patient;
  principalCareProviderIds?: NPIStringArray;
};

const PatientDiscoveryResponseSchema = z.object({
  patientMatch: z.boolean(),
  gateway: XCPDGatewaySchema,
  gatewayHomeCommunityId: z.string().optional(),
});

export const patientDiscoveryResponseIncomingSchema = z.union([
  z.intersection(baseResponseSchema, PatientDiscoveryResponseSchema),
  z.intersection(baseErrorResponseSchema, PatientDiscoveryResponseSchema),
]);
export type PatientDiscoveryResponseIncoming = z.infer<
  typeof patientDiscoveryResponseIncomingSchema
>;

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
