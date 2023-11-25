import { Patient } from "@medplum/fhirtypes";
import { NPIStringArray, oidStringSchema } from "./shared";
import { z } from "zod";

export const xcpdGatewaysSchema = z.array(
  z.object({
    oid: oidStringSchema,
    url: z.string(),
  })
);

export type XCPDGateways = z.infer<typeof xcpdGatewaysSchema>;

export type XCPDRequest = {
  id: string;
  cxId: string;
  xcpdGateways: XCPDGateways;
  timestamp: string;
  principalCareProviderNPIs?: NPIStringArray;
  patientResource: Patient;
};

export type XCPDPayload = {
  patient: Patient;
  cxId: string;
  xcpdGateways: XCPDGateways;
  principalCareProviderNPIs: NPIStringArray;
  requestId: string | undefined;
};

export const xcpdResponseSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  gatewayOID: z.string(),
  timestamp: z.string(),
  patientResource: z.object({
    resourceType: z.string(),
    id: z.string(),
    identifier: z.array(z.object({ system: z.string(), value: z.string() })),
    name: z.array(z.object({ family: z.string(), given: z.array(z.string()) })),
    telecom: z.array(z.object({ system: z.string(), value: z.string() })),
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
  }),
  patientMatch: z.boolean(),
  processingTimestamp: z.string(),
  operationOutcome: z.object({
    resourceType: z.string(),
    id: z.string(),
    issue: z.array(
      z.object({
        severity: z.string(),
        code: z.string(),
        details: z.object({ text: z.string() }),
      })
    ),
  }),
});

export type XCPDResponse = z.infer<typeof xcpdResponseSchema>;
