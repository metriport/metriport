import { EhexOutboundPatientDiscoveryResp } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/process/types";
import { EhexOutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";
import { DefaultPayload } from "./shared";

export type CreatePatientDiscoverRespParam = DefaultPayload & {
  status: string;
  response: EhexOutboundPatientDiscoveryResp;
};

export async function createOutboundPatientDiscoveryResp(
  payload: CreatePatientDiscoverRespParam
): Promise<EhexOutboundPatientDiscoveryRespModel> {
  return await EhexOutboundPatientDiscoveryRespModel.create({
    id: payload.id,
    requestId: payload.requestId,
    patientId: payload.patientId,
    status: payload.status,
    data: payload.response,
  });
}
