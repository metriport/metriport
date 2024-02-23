import { OutboundPatientDiscoveryResp } from "../../patient-discovery-result";
import { OutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";

export function getOutboundPatientDiscoveryResps(
  requestId: string,
  status: "success" | "failure"
): Promise<OutboundPatientDiscoveryResp[]> {
  return OutboundPatientDiscoveryRespModel.findAll({
    where: {
      requestId,
      status,
    },
  });
}

export function getOutboundPatientDiscoveryRespCount(requestId: string): Promise<number> {
  return OutboundPatientDiscoveryRespModel.count({
    where: { requestId },
  });
}
