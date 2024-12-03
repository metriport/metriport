import { DataTypes, Sequelize } from "sequelize";
import { CxMapping, CxMappingSource, CxSecondaryMappings } from "../domain/cx-mapping";
import { BaseModel, ModelSetup } from "./_default";

export class CxMappingModel extends BaseModel<CxMappingModel> implements CxMapping {
  static NAME = "cx_mapping";
  declare externalId: string;
  declare secondaryMappings: CxSecondaryMappings;
  declare cxId: string;
  declare source: CxMappingSource;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CxMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
        secondaryMappings: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: CxMappingModel.NAME,
      }
    );
  };
}
