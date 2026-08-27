import {
  OutboundPatientDiscoveryResp,
  outboundPatientDiscoveryRespFaultSchema,
  outboundPatientDiscoveryRespSuccessfulSchema,
  patientResourceSchema,
} from "@metriport/ihe-gateway-sdk";
import { externalGatewayPatientSchema } from "@metriport/ihe-gateway-sdk/models/shared";
import * as z from "zod";

export const patientMatchSchema = z.object({
  patientResource: patientResourceSchema,
  externalGatewayPatient: externalGatewayPatientSchema,
  custodianOid: z.string().nullish(),
});
export type PatientMatch = z.infer<typeof patientMatchSchema>;

export const ehexOutboundPatientDiscoveryRespSuccessfulSchema =
  outboundPatientDiscoveryRespSuccessfulSchema
    .omit({
      patientResource: true,
      externalGatewayPatient: true,
    })
    .extend({
      patientMatches: z.array(patientMatchSchema),
    });

export type EhexOutboundPatientDiscoveryRespSuccessful = z.infer<
  typeof ehexOutboundPatientDiscoveryRespSuccessfulSchema
>;

export const ehexOutboundPatientDiscoveryRespSchema = z.union([
  ehexOutboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
]);

export type EhexOutboundPatientDiscoveryResp = z.infer<
  typeof ehexOutboundPatientDiscoveryRespSchema
>;

export function isEhexSuccessfulOutboundPatientDiscoveryResponse(
  response: OutboundPatientDiscoveryResp | EhexOutboundPatientDiscoveryResp
): response is EhexOutboundPatientDiscoveryRespSuccessful {
  return (
    response.patientMatch === true &&
    "patientMatches" in response &&
    Array.isArray(response.patientMatches) &&
    response.patientMatches.length > 0
  );
}
