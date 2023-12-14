import { Sequelize } from "sequelize";
import { DocumentRetrievalResponse } from "@metriport/ihe-gateway-sdk";
import { DocumentRetrievalResult } from "../../domain/medical/ihe-result";
import { ModelSetup } from "../_default";
import { BaseIHEResultModel } from "./ihe-result";

export class DocumentRetrievalResultModel
  extends BaseIHEResultModel<DocumentRetrievalResultModel>
  implements DocumentRetrievalResult
{
  static NAME = "document_retrieval_result";
  declare data: DocumentRetrievalResponse;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentRetrievalResultModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: DocumentRetrievalResultModel.NAME,
    });
  };
}
