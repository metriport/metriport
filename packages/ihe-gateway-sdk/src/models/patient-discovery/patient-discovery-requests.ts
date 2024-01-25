import * as z from "zod";
import { baseRequestSchema, XCPDGatewaySchema } from "../shared";

const patientDiscoveryDefaultSchema = baseRequestSchema.extend({
  patientResource: z.any(),
});

// TO EXTERNAL GATEWAY
export const patientDiscoveryReqToExternalGWSchema = patientDiscoveryDefaultSchema.extend({
  gateways: z.array(XCPDGatewaySchema),
  principalCareProviderIds: z.array(z.string()).optional(),
});

export type PatientDiscoveryReqToExternalGW = z.infer<typeof patientDiscoveryReqToExternalGWSchema>;

// FROM EXTERNAL GATEWAY
export const patientDiscoveryReqFromExternalGatewaySchema = patientDiscoveryDefaultSchema.omit({
  cxId: true,
});

export type PatientDiscoveryReqFromExternalGW = z.infer<
  typeof patientDiscoveryReqFromExternalGatewaySchema
>;
