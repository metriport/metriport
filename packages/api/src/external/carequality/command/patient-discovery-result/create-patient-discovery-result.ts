import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { PatientDiscoveryResultModel } from "../../models/patient-discovery-result";
import { getIheResultStatus } from "../../../../domain/medical/ihe-result";

export async function createPatientDiscoveryResult(
  pdResponse: PatientDiscoveryResponse
): Promise<void> {
  const { id, operationOutcome, patientId, patientMatch } = pdResponse;

  await PatientDiscoveryResultModel.create({
    id: uuidv7(),
    requestId: id,
    patientId,
    status: getIheResultStatus({ operationOutcome, patientMatch }),
    data: pdResponse,
  });
}
