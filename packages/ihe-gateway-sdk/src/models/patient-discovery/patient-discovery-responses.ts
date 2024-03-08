import * as z from "zod";
import {
  baseResponseSchema,
  BaseResponse,
  baseErrorResponseSchema,
  externalGatewayPatientSchema,
  XCPDGatewaySchema,
} from "../shared";

// TODO: Test that this schema is correct for the patientResource in the IHE response
const patientSchema = z.object({
  resourceType: z.literal("Patient"),
  active: z.boolean(),
  name: z.array(
    z.object({
      family: z.string(),
      given: z.array(z.string()),
    })
  ),
  gender: z.string(),
  birthDate: z.string(),
  address: z.array(
    z.object({
      line: z.array(z.string()),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
  ),
});

export type Patient = z.infer<typeof patientSchema>;

const patientDiscoveryRespSuccessfulDefaultSchema = baseResponseSchema.extend({
  patientMatch: z.literal(true),
  gatewayHomeCommunityId: z.string(),
});

// TO EXTERNAL GATEWAY
const inboundPatientDiscoveryRespSuccessfulSchema =
  patientDiscoveryRespSuccessfulDefaultSchema.extend({
    patientMatchDegree: z.number().optional(),
    patientResource: z.object({}),
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

export type InboundPatientDiscoveryResp = z.infer<typeof inboundPatientDiscoveryRespSchema>;

// FROM EXTERNAL GATEWAY
const outboundPatientDiscoveryRespDefaultSchema = baseResponseSchema.extend({
  gateway: XCPDGatewaySchema,
  patientId: z.string(),
});

const outboundPatientDiscoveryRespSuccessfulSchema = outboundPatientDiscoveryRespDefaultSchema
  .merge(patientDiscoveryRespSuccessfulDefaultSchema)
  .extend({
    patientResource: patientSchema.optional(),
  });

export type OutboundPatientDiscoveryRespSuccessful = z.infer<
  typeof outboundPatientDiscoveryRespSuccessfulSchema
>;

const outboundPatientDiscoveryRespFaultSchema = outboundPatientDiscoveryRespDefaultSchema.extend({
  patientMatch: z.literal(false).or(z.literal(null)),
});

export const outboundPatientDiscoveryRespSchema = z.union([
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
]);

export type OutboundPatientDiscoveryResp = z.infer<typeof outboundPatientDiscoveryRespSchema>;

export function isOutboundPDRespSuccessful(
  obj: BaseResponse
): obj is OutboundPatientDiscoveryRespSuccessful & { patientResource: Patient } {
  return "patientResource" in obj;
}
