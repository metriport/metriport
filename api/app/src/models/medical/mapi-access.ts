import { Sequelize } from "sequelize";
import { BaseModel, defaultModelOptions, ModelSetup } from "../_default";

export class MAPIAccess extends BaseModel<MAPIAccess> {
  static NAME = "mapi_access";

  static setup: ModelSetup = (sequelize: Sequelize) => {
    MAPIAccess.init(
      {
        ...BaseModel.baseAttributes(),
      },
      {
        ...defaultModelOptions(sequelize),
        tableName: MAPIAccess.NAME,
      }
    );
  };
}
