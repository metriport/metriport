import { Sequelize } from "sequelize";
import { DocumentQueryRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResult } from "../document-query-result";
import { ModelSetup } from "../../../models/_default";
import { BaseIHEResultModel } from "../../../models/medical/ihe-result";

export class DocumentQueryResultModel
  extends BaseIHEResultModel<DocumentQueryResultModel>
  implements DocumentQueryResult
{
  static NAME = "document_query_result";
  declare data: DocumentQueryRespFromExternalGW;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentQueryResultModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: DocumentQueryResultModel.NAME,
    });
  };
}
