import { Sequelize } from "sequelize";
import { DocumentQueryResponse } from "@metriport/ihe-gateway-sdk";
import { IHEResult } from "../../domain/medical/ihe-result";
import { ModelSetup, BaseIHEResultModel } from "../_default";

export class DocumentQueryResultModel
  extends BaseIHEResultModel<DocumentQueryResultModel>
  implements IHEResult<DocumentQueryResponse>
{
  static NAME = "document_query_result";
  declare data: DocumentQueryResponse;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentQueryResultModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: DocumentQueryResultModel.NAME,
    });
  };
}
