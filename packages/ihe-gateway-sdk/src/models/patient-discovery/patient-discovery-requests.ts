import * as z from "zod";
import { baseRequestSchema, XCPDGatewaySchema, patientResourceSchema } from "../shared";

const patientDiscoveryDefaultSchema = baseRequestSchema.extend({
  patientResource: patientResourceSchema,
});

// TO EXTERNAL GATEWAY
export const outboundPatientDiscoveryReqSchema = patientDiscoveryDefaultSchema.extend({
  gateways: z.array(XCPDGatewaySchema),
  principalCareProviderIds: z.array(z.string()),
  patientId: z.string(),
  cxId: z.string(),
});

export type OutboundPatientDiscoveryReq = z.infer<typeof outboundPatientDiscoveryReqSchema>;

// FROM EXTERNAL GATEWAY
export const inboundPatientDiscoveryReqSchema = patientDiscoveryDefaultSchema.omit({
  cxId: true,
});

export type InboundPatientDiscoveryReq = z.infer<typeof inboundPatientDiscoveryReqSchema>;
