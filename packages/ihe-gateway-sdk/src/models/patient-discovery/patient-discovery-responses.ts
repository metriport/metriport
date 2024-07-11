import * as z from "zod";
import {
  baseErrorResponseSchema,
  baseResponseSchema,
  externalGatewayPatientSchema,
  XCPDGatewaySchema,
} from "../shared";
import { patientResourceSchema } from "./patient";

const patientDiscoveryRespSuccessfulDefaultSchema = baseResponseSchema.extend({
  patientMatch: z.literal(true),
  gatewayHomeCommunityId: z.string(),
});

// TO EXTERNAL GATEWAY
const inboundPatientDiscoveryRespSuccessfulSchema =
  patientDiscoveryRespSuccessfulDefaultSchema.extend({
    patientMatchDegree: z.number().optional(),
    patientResource: patientResourceSchema,
    externalGatewayPatient: externalGatewayPatientSchema,
  });

const inboundPatientDiscoveryRespSuccessfulNoMatchSchema = baseResponseSchema.extend({
  patientMatch: z.literal(false),
  gatewayHomeCommunityId: z.string(),
});

const inboundPatientDiscoveryRespFaultSchema = baseErrorResponseSchema.extend({
  patientMatch: z.literal(null),
  gatewayHomeCommunityId: z.string(),
});

export const inboundPatientDiscoveryRespSchema = z.union([
  inboundPatientDiscoveryRespSuccessfulSchema,
  inboundPatientDiscoveryRespSuccessfulNoMatchSchema,
  inboundPatientDiscoveryRespFaultSchema,
]);

export type InboundPatientDiscoveryRespSuccess = z.infer<
  typeof inboundPatientDiscoveryRespSuccessfulSchema
>;

export type InboundPatientDiscoveryResp = z.infer<typeof inboundPatientDiscoveryRespSchema>;

// FROM EXTERNAL GATEWAY
const outboundPatientDiscoveryRespDefaultSchema = baseResponseSchema.extend({
  gateway: XCPDGatewaySchema,
});

export const outboundPatientDiscoveryRespSuccessfulSchema =
  outboundPatientDiscoveryRespDefaultSchema
    .merge(patientDiscoveryRespSuccessfulDefaultSchema)
    .extend({
      patientResource: patientResourceSchema,
    });

export const outboundPatientDiscoveryRespFaultSchema =
  outboundPatientDiscoveryRespDefaultSchema.extend({
    patientMatch: z.literal(false).or(z.literal(null)),
  });

export type OutboundPatientDiscoveryRespSuccessfulSchema = z.infer<
  typeof outboundPatientDiscoveryRespSuccessfulSchema
>;

export type OutboundPatientDiscoveryRespFaultSchema = z.infer<
  typeof outboundPatientDiscoveryRespFaultSchema
>;

export const outboundPatientDiscoveryRespSchema = z.union([
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
]);

export type OutboundPatientDiscoveryResp = z.infer<typeof outboundPatientDiscoveryRespSchema>;

export function isSuccessfulInboundPatientDiscoveryResponse(
  response: InboundPatientDiscoveryResp
): response is InboundPatientDiscoveryRespSuccess {
  return "patientResource" in response;
}

export function isNonErroringOutboundPatientDiscoveryResponse(
  response: OutboundPatientDiscoveryResp
): response is OutboundPatientDiscoveryResp {
  return response.patientMatch != null;
}
