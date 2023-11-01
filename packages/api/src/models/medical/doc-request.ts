import { DataTypes, Sequelize } from "sequelize";
import { DocRequest, DocRequestMetadata } from "../../domain/medical/doc-request";
import { DocumentQueryProgress } from "../../domain/medical/document-query";
import { BaseModel, ModelSetup } from "../_default";

export class DocRequestModel extends BaseModel<DocRequestModel> implements DocRequest {
  static NAME = "docRequest";
  declare cxId: string;
  declare patientId: string;
  declare facilityIds: string[];
  declare metadata: DocRequestMetadata;
  declare documentQueryProgress: DocumentQueryProgress;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    DocRequestModel.init(
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
        tableName: DocRequestModel.NAME,
      }
    );
  };
}
