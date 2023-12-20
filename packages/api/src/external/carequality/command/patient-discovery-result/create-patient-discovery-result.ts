import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientDiscoveryResultModel } from "../../../../models/medical/patient-discovery-result";

export async function createPatientDiscoveryResult(
  pdResponse: PatientDiscoveryResponse
): Promise<void> {
  const { id, operationOutcome, patientResourceId } = pdResponse;

  await PatientDiscoveryResultModel.create({
    id: uuidv7(),
    requestId: id,
    patientId: patientResourceId,
    status: operationOutcome?.issue ? "failure" : "success",
    data: pdResponse,
  });
}
