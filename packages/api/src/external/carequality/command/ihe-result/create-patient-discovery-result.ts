import { PatientDiscoveryRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResultModel } from "../../models/patient-discovery-result";
import { DefaultPayload } from "./shared";

export type CreatePatientDiscoverPayload = {
  defaultPayload: DefaultPayload;
  status: string;
  response: PatientDiscoveryRespFromExternalGW;
};

export async function createPatientDiscoveryResult(
  payload: CreatePatientDiscoverPayload
): Promise<PatientDiscoveryResultModel> {
  return await PatientDiscoveryResultModel.create({
    ...payload.defaultPayload,
    status: payload.status,
    data: payload.response,
  });
}
