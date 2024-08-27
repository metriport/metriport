import { DataTypes, Sequelize } from "sequelize";
import { CxMapping } from "../domain/cx-mapping";
import { BaseModelNoId, ModelSetup } from "./_default";

export class CxMappingModel extends BaseModelNoId<CxMappingModel> implements CxMapping {
  static NAME = "cx_mapping";
  declare externalId: string;
  declare cxId: string;
  declare source: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    CxMappingModel.init(
      {
        ...BaseModelNoId.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModelNoId.modelOptions(sequelize),
        tableName: CxMappingModel.NAME,
      }
    );
  };
}
