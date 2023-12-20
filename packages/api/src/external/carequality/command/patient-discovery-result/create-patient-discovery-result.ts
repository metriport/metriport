import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResultModel } from "../../models/patient-discovery-result";

export async function createPatientDiscoveryResult(
  pdResponse: PatientDiscoveryResponse
): Promise<void> {
  const { id, operationOutcome, patientId, patientMatch } = pdResponse;
  const hasError = operationOutcome?.issue && !patientMatch;

  await PatientDiscoveryResultModel.create({
    id: uuidv7(),
    requestId: id,
    patientId,
    status: hasError ? "failure" : "success",
    data: pdResponse,
  });
}
