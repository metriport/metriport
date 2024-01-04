import { Sequelize } from "sequelize";
import { DocumentQueryResponse } from "@metriport/core/src/external/carequality/domain/document-query-result";
import { DocumentQueryResult } from "../../external/carequality/domain/document-query-result";
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
