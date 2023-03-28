import { Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

export class MAPIAccess extends BaseModel<MAPIAccess> {
  static NAME = "mapi_access";

  static setup: ModelSetup = (sequelize: Sequelize) => {
    MAPIAccess.init(
      {
        ...BaseModel.attributes(),
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: MAPIAccess.NAME,
      }
    );
  };
}
