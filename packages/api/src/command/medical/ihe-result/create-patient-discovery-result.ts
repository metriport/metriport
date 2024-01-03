import { PatientDiscoveryResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResultModel } from "../../../external/carequality/models/patient-discovery-result";
import { DefaultPayload } from "./shared";

export async function createPatientDiscoveryResult(
  defaultPayload: DefaultPayload,
  status: string,
  response: PatientDiscoveryResponseIncoming
): Promise<void> {
  await PatientDiscoveryResultModel.create({
    ...defaultPayload,
    status,
    data: response,
  });
}
