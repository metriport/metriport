import { Patient } from "@medplum/fhirtypes";
import {
  NPIStringArray,
  oidStringSchema,
  BaseResponse,
  baseResponseSchema,
  BaseRequest,
  baseRequestSchema,
  patientResourceSchema,
} from "./shared";
import { z } from "zod";

export const xcpdGatewaysSchema = z.array(
  z.object({
    oid: oidStringSchema,
    url: z.string(),
    id: z.string(),
  })
);
export type XCPDGateways = z.infer<typeof xcpdGatewaysSchema>;

// The following are for us crating a patient discovery request
export type PatientDiscoveryRequestOutgoing = BaseRequest & {
  cxId: string;
  xcpdGateways: XCPDGateways;
  patientResource: Patient;
  principalCareProviderNPIs?: NPIStringArray;
};

export const PatientDiscoveryResponseIncomingSchema = baseResponseSchema.extend({
  cxId: z.string(),
  patientMatch: z.boolean(),
  xcpdHomeCommunityId: z.string(),
});

export type PatientDiscoveryResponseIncoming = z.infer<
  typeof PatientDiscoveryResponseIncomingSchema
>;

// The following are for us responding to a patient discovery request
export const PatientDiscoveryRequestIncomingSchema = baseRequestSchema.extend({
  patientResource: patientResourceSchema,
});

export type PatientDiscoveryRequestIncoming = z.infer<typeof PatientDiscoveryRequestIncomingSchema>;

export type PatientDiscoveryResponseOutgoing = BaseResponse & {
  patientMatch: boolean;
  xcpdHomeCommunityId: string;
  patientResource?: Patient;
};
