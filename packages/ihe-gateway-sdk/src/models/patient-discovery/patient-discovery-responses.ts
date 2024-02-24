import * as z from "zod";
import {
  baseResponseSchema,
  baseErrorResponseSchema,
  externalGatewayPatientSchema,
  XCPDGatewaySchema,
} from "../shared";

const patientDiscoveryRespSuccessfulDefaultSchema = baseResponseSchema.extend({
  patientMatch: z.literal(true),
  patientResource: z.object({}),
  xcpdHomeCommunityId: z.string(),
});

// TO EXTERNAL GATEWAY
const inboundPatientDiscoveryRespSuccessfulSchema =
  patientDiscoveryRespSuccessfulDefaultSchema.extend({
    patientMatchDegree: z.number().optional(),
    externalGatewayPatient: externalGatewayPatientSchema,
  });

const inboundPatientDiscoveryRespSuccessfulNoMatchSchema = baseResponseSchema.extend({
  patientMatch: z.literal(false),
  xcpdHomeCommunityId: z.string(),
});

const inboundPatientDiscoveryRespFaultSchema = baseErrorResponseSchema.extend({
  patientMatch: z.literal(null),
  xcpdHomeCommunityId: z.string(),
});

export const inboundPatientDiscoveryRespSchema = z.union([
  inboundPatientDiscoveryRespSuccessfulSchema,
  inboundPatientDiscoveryRespSuccessfulNoMatchSchema,
  inboundPatientDiscoveryRespFaultSchema,
]);

export type InboundPatientDiscoveryResp = z.infer<typeof inboundPatientDiscoveryRespSchema>;

// FROM EXTERNAL GATEWAY
const outboundPatientDiscoveryRespDefaultSchema = baseResponseSchema.extend({
  gateway: XCPDGatewaySchema,
  patientResourceId: z.string(),
});

const outboundPatientDiscoveryRespSuccessfulSchema =
  outboundPatientDiscoveryRespDefaultSchema.merge(patientDiscoveryRespSuccessfulDefaultSchema);

const outboundPatientDiscoveryRespFaultSchema = outboundPatientDiscoveryRespDefaultSchema.extend({
  patientMatch: z.literal(false).or(z.literal(null)),
});

export const outboundPatientDiscoveryRespSchema = z.union([
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
]);

export type OutboundPatientDiscoveryResp = z.infer<typeof outboundPatientDiscoveryRespSchema>;
