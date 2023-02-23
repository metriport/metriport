import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

export class MAPIAccess extends BaseModel<MAPIAccess> {
  static NAME = "mapi_access";
  declare id: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    MAPIAccess.init(
      {
        ...BaseModel.baseAttributes(),
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: MAPIAccess.NAME,
      }
    );
  };
}
