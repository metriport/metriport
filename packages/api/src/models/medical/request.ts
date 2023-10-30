import { DataTypes, Sequelize } from "sequelize";
import { Request, RequestMetadata } from "../../domain/medical/request";
import { DocumentQueryProgress } from "../../domain/medical/document-query";
import { BaseModel, ModelSetup } from "../_default";

export class RequestModel extends BaseModel<RequestModel> implements Request {
  static NAME = "request";
  declare cxId: string;
  declare patientId: string;
  declare facilityIds: string[];
  declare metadata: RequestMetadata;
  declare documentQueryProgress: DocumentQueryProgress;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    RequestModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.STRING),
        },
        metadata: {
          type: DataTypes.JSONB,
        },
        documentQueryProgress: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: RequestModel.NAME,
      }
    );
  };
}
