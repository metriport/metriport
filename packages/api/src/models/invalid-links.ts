import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";
import { InvalidLinks, InvalidLinksData } from "../domain/invalid-links";

export class InvalidLinksModel extends BaseModel<InvalidLinksModel> implements InvalidLinks {
  static NAME = "invalid_links";
  declare id: string;
  declare cxId: string;
  declare data: InvalidLinksData;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    InvalidLinksModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: InvalidLinksModel.NAME,
      }
    );
  };
}
