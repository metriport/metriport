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
