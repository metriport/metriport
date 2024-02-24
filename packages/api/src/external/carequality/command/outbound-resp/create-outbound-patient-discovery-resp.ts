import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { OutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";
import { DefaultPayload } from "./shared";

export type CreatePatientDiscoverRespPayload = DefaultPayload & {
  status: string;
  response: OutboundPatientDiscoveryResp;
};

export async function createOutboundPatientDiscoveryResp(
  payload: CreatePatientDiscoverRespPayload
): Promise<OutboundPatientDiscoveryRespModel> {
  return await OutboundPatientDiscoveryRespModel.create({
    id: payload.id,
    requestId: payload.requestId,
    patientId: payload.patientId,
    status: payload.status,
    data: payload.response,
  });
}
