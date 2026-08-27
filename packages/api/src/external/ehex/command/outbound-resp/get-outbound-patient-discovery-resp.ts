import { EhexOutboundPatientDiscoveryRespModel } from "../../models/outbound-patient-discovery-resp";

export async function getEhexOutboundPatientDiscoveryResp(
  requestId: string
): Promise<EhexOutboundPatientDiscoveryRespModel[]> {
  return await EhexOutboundPatientDiscoveryRespModel.findAll({
    where: {
      requestId,
    },
  });
}
