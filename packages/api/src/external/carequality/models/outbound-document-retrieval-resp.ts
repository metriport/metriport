import { Sequelize } from "sequelize";
import { OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentRetrievalResp } from "../outbound-document-retrieval-resp";
import { ModelSetup } from "../../../models/_default";
import { BaseOutboundRespModel } from "../../../models/medical/outbound-resp";

export class OutboundDocumentRetrievalRespModel
  extends BaseOutboundRespModel<OutboundDocumentRetrievalRespModel>
  implements OutboundDocumentRetrievalResp
{
  static NAME = "document_retrieval_result";
  declare data: IHEOutboundDocumentRetrievalResp;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OutboundDocumentRetrievalRespModel.init(BaseOutboundRespModel.attributes(), {
      ...BaseOutboundRespModel.modelOptions(sequelize),
      tableName: OutboundDocumentRetrievalRespModel.NAME,
    });
  };
}
