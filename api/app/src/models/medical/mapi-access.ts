import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

export class MAPIAccess extends BaseModel<MAPIAccess> {
  static NAME = "mapi_access";
  declare cxId: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    MAPIAccess.init(
      {
        ...BaseModel.baseAttributes(),
        cxId: {
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
