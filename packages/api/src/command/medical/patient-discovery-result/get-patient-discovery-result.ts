import { PatientDiscoveryResult } from "../../../domain/medical/patient-discovery-result";
import { PatientDiscoveryResultModel } from "../../../models/medical/patient-discovery-result";

export async function getPatientDiscoveryResults(
  requestId: string
): Promise<PatientDiscoveryResult[]> {
  return await PatientDiscoveryResultModel.findAll({
    where: {
      requestId,
      status: "success",
    },
  });
}

export async function getPatientDiscoveryResultCount(requestId: string): Promise<number> {
  return await PatientDiscoveryResultModel.count({
    where: { requestId },
  });
}
