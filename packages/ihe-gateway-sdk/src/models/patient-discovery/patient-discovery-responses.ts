import * as z from "zod";
import {
  XCPDGatewaySchema,
  baseErrorResponseSchema,
  baseResponseSchema,
  externalGatewayPatientSchema,
} from "../shared";

export const inboundPatientResourceSchema = z.object({
  name: z
    .array(
      z.object({
        family: z.string().optional(),
        given: z.array(z.string()).optional(),
      })
    )
    .optional(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  birthDate: z.string().optional(),
  address: z.array(
    z.object({
      line: z.array(z.string()).optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
  ),
});

export type InboundPatientResource = z.infer<typeof inboundPatientResourceSchema>;

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

export const outboundPatientDiscoveryRespSuccessfulSchema =
  outboundPatientDiscoveryRespDefaultSchema
    .merge(patientDiscoveryRespSuccessfulDefaultSchema)
    .extend({
      patientResource: inboundPatientResourceSchema.optional(),
    });

export const outboundPatientDiscoveryRespFaultSchema =
  outboundPatientDiscoveryRespDefaultSchema.extend({
    patientMatch: z.literal(false).or(z.literal(null)),
  });

export const outboundPatientDiscoveryRespSchema = z.union([
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
]);

export type OutboundPatientDiscoveryResp = z.infer<typeof outboundPatientDiscoveryRespSchema>;
