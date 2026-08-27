import { PatientRoster } from "@metriport/shared";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";
import { RosterModel } from "./roster";

export class PatientRosterModel extends BaseModel<PatientRosterModel> implements PatientRoster {
  static NAME = "patient_roster";

  declare patientId: string;
  declare rosterId: string;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientRosterModel.init(
      {
        ...BaseModel.attributes(),
        patientId: {
          type: DataTypes.UUID,
        },
        rosterId: {
          type: DataTypes.UUID,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: this.NAME,
      }
    );
  };

  static associate = (models: { RosterModel: typeof RosterModel }) => {
    PatientRosterModel.belongsTo(models.RosterModel, {
      foreignKey: "rosterId",
      targetKey: "id",
      as: "Roster",
    });
  };
}
