import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { OutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";
import { DefaultPayload } from "./shared";

export type CreatePatientDiscoverRespPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: OutboundPatientDiscoveryResp;
};

export async function createPatientDiscoveryResult(
  payload: CreatePatientDiscoverRespPayload
): Promise<OutboundPatientDiscoveryRespModel> {
  return await OutboundPatientDiscoveryRespModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}
