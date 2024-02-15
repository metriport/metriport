import { PatientDiscoveryResp } from "../../patient-discovery-result";
import { OutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";

export async function getOutboundPatientDiscoveryResps(
  requestId: string
): Promise<PatientDiscoveryResp[]> {
  return await OutboundPatientDiscoveryRespModel.findAll({
    where: {
      requestId,
      status: "success",
    },
  });
}

export async function getPatientDiscoveryRespCount(requestId: string): Promise<number> {
  return await OutboundPatientDiscoveryRespModel.count({
    where: { requestId },
  });
}
