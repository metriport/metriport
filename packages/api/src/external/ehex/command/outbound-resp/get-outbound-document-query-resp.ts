import { EhexOutboundDocumentQueryRespModel } from "../../models/outbound-document-query-resp";

export async function getEhexOutboundDocumentQueryResp(
  requestId: string
): Promise<EhexOutboundDocumentQueryRespModel[]> {
  return await EhexOutboundDocumentQueryRespModel.findAll({
    where: {
      requestId,
    },
  });
}
