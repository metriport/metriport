import { DataTypes, Sequelize } from "sequelize";
import { EhrAccess, Ehr } from "../domain/ehr-access";
import { BaseModelNoId, ModelSetup } from "./_default";

export class EhrAccessModel extends BaseModelNoId<EhrAccessModel> implements EhrAccess {
  static NAME = "ehr_access";
  declare cxId: string;
  declare ehrId: string;
  declare ehrName: Ehr;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    EhrAccessModel.init(
      {
        ...BaseModelNoId.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        ehrId: {
          type: DataTypes.STRING,
        },
        ehrName: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModelNoId.modelOptions(sequelize),
        tableName: EhrAccessModel.NAME,
      }
    );
  };
}
