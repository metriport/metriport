import { OutboundPatientDiscoveryResp } from "@metriport/core/external/carequality/ihe-gateway-types";
import { OutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";
import { DefaultPayload } from "./shared";

export type CreatePatientDiscoverRespParam = DefaultPayload & {
  status: string;
  response: OutboundPatientDiscoveryResp;
};

export async function createOutboundPatientDiscoveryResp(
  payload: CreatePatientDiscoverRespParam
): Promise<OutboundPatientDiscoveryRespModel> {
  return await OutboundPatientDiscoveryRespModel.create({
    id: payload.id,
    requestId: payload.requestId,
    patientId: payload.patientId,
    status: payload.status,
    data: payload.response,
  });
}
