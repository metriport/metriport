import { Sequelize } from "sequelize";
import { DocumentRetrievalRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { IHEToExternalGwDocumentRetrieval } from "../ihe-to-external-gw-document-retrieval";
import { ModelSetup } from "../../../models/_default";
import { BaseIHEResultModel } from "../../../models/medical/ihe-result";

export class IHEToExternalGwDocumentRetrievalModel
  extends BaseIHEResultModel<IHEToExternalGwDocumentRetrievalModel>
  implements IHEToExternalGwDocumentRetrieval
{
  static NAME = "document_retrieval_result";
  declare data: DocumentRetrievalRespFromExternalGW;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    IHEToExternalGwDocumentRetrievalModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: IHEToExternalGwDocumentRetrievalModel.NAME,
    });
  };
}
