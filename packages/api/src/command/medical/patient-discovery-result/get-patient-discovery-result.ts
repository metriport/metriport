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
