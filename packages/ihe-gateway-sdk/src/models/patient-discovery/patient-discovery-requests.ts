import * as z from "zod";
import { baseRequestSchema, XCPDGatewaySchema } from "../shared";

const patientDiscoveryDefaultSchema = baseRequestSchema.extend({
  patientResource: z
    .any()
    .refine(value => value !== undefined, { message: "patientResource is required" }),
});

// TO EXTERNAL GATEWAY
export const outboundPatientDiscoveryReqSchema = patientDiscoveryDefaultSchema.extend({
  gateways: z.array(XCPDGatewaySchema),
  principalCareProviderIds: z.array(z.string()).optional(),
});

export type OutboundPatientDiscoveryReq = z.infer<typeof outboundPatientDiscoveryReqSchema>;

// FROM EXTERNAL GATEWAY
export const inboundPatientDiscoveryReqSchema = patientDiscoveryDefaultSchema.omit({
  cxId: true,
});

export type InboundPatientDiscoveryReq = z.infer<typeof inboundPatientDiscoveryReqSchema>;
