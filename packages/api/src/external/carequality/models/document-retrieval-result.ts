import { Sequelize } from "sequelize";
import { DocumentRetrievalRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { DocumentRetrievalResult } from "../document-retrieval-result";
import { ModelSetup } from "../../../models/_default";
import { BaseIHEResultModel } from "../../../models/medical/ihe-result";

export class DocumentRetrievalResultModel
  extends BaseIHEResultModel<DocumentRetrievalResultModel>
  implements DocumentRetrievalResult
{
  static NAME = "document_retrieval_result";
  declare data: DocumentRetrievalRespFromExternalGW;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocumentRetrievalResultModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: DocumentRetrievalResultModel.NAME,
    });
  };
}
