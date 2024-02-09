import { Sequelize } from "sequelize";
import { DocumentQueryRespFromExternalGW } from "@metriport/ihe-gateway-sdk";
import { IHEToExternalGwDocumentQuery } from "../ihe-to-external-gw-document-query";
import { ModelSetup } from "../../../models/_default";
import { BaseIHEResultModel } from "../../../models/medical/ihe-result";

export class IHEToExternalGwDocumentQueryModel
  extends BaseIHEResultModel<IHEToExternalGwDocumentQueryModel>
  implements IHEToExternalGwDocumentQuery
{
  static NAME = "document_query_result";
  declare data: DocumentQueryRespFromExternalGW;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    IHEToExternalGwDocumentQueryModel.init(BaseIHEResultModel.attributes(), {
      ...BaseIHEResultModel.modelOptions(sequelize),
      tableName: IHEToExternalGwDocumentQueryModel.NAME,
    });
  };
}
