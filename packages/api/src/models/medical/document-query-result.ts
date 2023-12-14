import { Sequelize } from "sequelize";
import { DocumentQueryResponse } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResult } from "../../domain/medical/ihe-result";
import { ModelSetup } from "../_default";
import { BaseIHEResultModel } from "./ihe-result";

export class DocumentQueryResultModel
  extends BaseIHEResultModel<DocumentQueryResultModel>
  implements DocumentQueryResult
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
