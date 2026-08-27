import { EhexOutboundDocumentRetrievalRespModel } from "../../models/outbound-document-retrieval-resp";

export async function getEhexOutboundDocumentRetrievalResp(
  requestId: string
): Promise<EhexOutboundDocumentRetrievalRespModel[]> {
  return await EhexOutboundDocumentRetrievalRespModel.findAll({
    where: {
      requestId,
    },
  });
}
