import { OutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";

export async function getOutboundPatientDiscoveryResp(
  requestId: string
): Promise<OutboundPatientDiscoveryRespModel[]> {
  return await OutboundPatientDiscoveryRespModel.findAll({
    where: {
      requestId,
    },
  });
}
