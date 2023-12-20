import { Patient } from "@medplum/fhirtypes";
import { NPIStringArray, oidStringSchema, SamlAttributes, baseResponseSchema } from "./shared";
import { z } from "zod";

export const xcpdGatewaysSchema = z.array(
  z.object({
    oid: oidStringSchema,
    url: z.string(),
    id: z.string(),
  })
);

export type XCPDGateways = z.infer<typeof xcpdGatewaysSchema>;

export type PatientDiscoveryRequest = {
  id: string;
  cxId: string;
  timestamp: string;
  gateways: XCPDGateways;
  samlAttributes: SamlAttributes;
  patientResource: Patient;
  principalCareProviderIds?: NPIStringArray;
};

export const patientDiscoveryResponseSchema = baseResponseSchema.extend({
  patientMatch: z.boolean(),
  xcpdHomeCommunityId: z.string().nullish(),
});

export type PatientDiscoveryResponse = z.infer<typeof patientDiscoveryResponseSchema>;
