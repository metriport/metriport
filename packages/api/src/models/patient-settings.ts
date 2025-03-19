import { PatientSettings, Subscriptions } from "@metriport/core/domain/patient-settings";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";
import { PatientModel } from "./medical/patient";

export class PatientSettingsModel
  extends BaseModel<PatientSettingsModel>
  implements PatientSettings
{
  static NAME = "patient_settings";
  declare id: string;
  declare cxId: string;
  declare patientId: string;
  declare subscriptions: Subscriptions | undefined;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientSettingsModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.STRING,
          references: {
            model: "patient",
            key: "id",
          },
        },
        subscriptions: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientSettingsModel.NAME,
      }
    );
  };

  static associate = (models: { PatientModel: typeof PatientModel }) => {
    PatientSettingsModel.belongsTo(models.PatientModel, {
      foreignKey: "patientId",
      targetKey: "id",
      as: "patient",
    });
  };
}
