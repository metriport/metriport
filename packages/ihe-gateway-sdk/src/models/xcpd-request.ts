import { Patient } from "@medplum/fhirtypes";
import { npiStringSchema, oidStringSchema } from "./shared";
import { z } from "zod";

export type XCPDGateway = {
  oid: string;
  url: string;
};

export const xcpdGatewaySchema = z.array(
  z.object({
    oid: oidStringSchema,
    url: z.string(),
  })
);

export const principalCareProviderIdsSchema = z.array(npiStringSchema);

export type XCPDRequest = {
  id: string;
  cxId: string;
  xcpdGateways: XCPDGateway[];
  timestamp: string;
  principalCareProviderIds?: string[];
  patientResource: Patient;
};
