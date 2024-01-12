import { Sequelize } from "sequelize";
import { DocumentRetrievalResult } from "../../external/carequality/document-retrieval-result";
import { DocumentRetrievalResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { ModelSetup } from "../_default";
import { BaseIHEResultModel } from "./ihe-result";

export class DocumentRetrievalResultModel
  extends BaseIHEResultModel<DocumentRetrievalResultModel>
  implements DocumentRetrievalResult
{
  static NAME = "document_retrieval_result";
  declare data: DocumentRetrievalResponseIncoming;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentRetrievalResultModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: DocumentRetrievalResultModel.NAME,
    });
  };
}
