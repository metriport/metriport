import { Sequelize } from "sequelize";
import { OutboundDocumentQueryResp as IHEOutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { OutboundDocumentQueryResp } from "../outbound-document-query-resp";
import { ModelSetup } from "../../../models/_default";
import { BaseOutboundRespModel } from "../../../models/medical/outbound-resp";

export class OutboundDocumentQueryRespModel
  extends BaseOutboundRespModel<OutboundDocumentQueryRespModel>
  implements OutboundDocumentQueryResp
{
  static NAME = "document_query_result";
  declare data: IHEOutboundDocumentQueryResp;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    OutboundDocumentQueryRespModel.init(BaseOutboundRespModel.attributes(), {
      ...BaseOutboundRespModel.modelOptions(sequelize),
      tableName: OutboundDocumentQueryRespModel.NAME,
    });
  };
}
