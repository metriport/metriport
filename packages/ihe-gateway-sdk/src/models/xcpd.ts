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

export type XCPDRequest = {
  id: string;
  cxId: string;
  timestamp: string;
  xcpdGateways: XCPDGateways;
  principalCareProviderNPIs?: NPIStringArray;
  samlAttributes: SamlAttributes;
  patientResource: Patient;
};

export type XCPDPayload = {
  patient: Patient;
  cxId: string;
  xcpdGateways: XCPDGateways;
  principalCareProviderNPIs: NPIStringArray;
  org: {
    oid: string;
    name: string;
  };
  requestId: string | undefined;
};

export const xcpdResponseSchema = baseResponseSchema.extend({
  patientMatch: z.boolean(),
});

export type XCPDResponse = z.infer<typeof xcpdResponseSchema>;
