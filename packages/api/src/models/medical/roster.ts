import { Roster, RosterStatus } from "@metriport/shared";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { PatientRosterModel } from "./patient-roster";

export class RosterModel extends BaseModel<RosterModel> implements Roster {
  static NAME = "roster";
  declare cxId: string;
  declare source: string;
  declare type: string;
  declare status: RosterStatus;
  declare data: unknown;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    RosterModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        source: {
          type: DataTypes.STRING,
        },
        type: {
          type: DataTypes.STRING,
        },
        status: {
          type: DataTypes.STRING,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: this.NAME,
      }
    );
  };

  static associate = (models: { PatientRosterModel: typeof PatientRosterModel }) => {
    RosterModel.hasMany(models.PatientRosterModel, {
      foreignKey: "rosterId",
      sourceKey: "id",
      as: "PatientRoster",
    });
  };
}
