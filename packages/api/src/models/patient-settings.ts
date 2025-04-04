import { PatientSettings, Subscriptions } from "@metriport/core/domain/patient-settings";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";
import { PatientModelReadOnly } from "./medical/patient-readonly";

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

  static associate = (models: { PatientModelReadOnly: typeof PatientModelReadOnly }) => {
    PatientSettingsModel.belongsTo(models.PatientModelReadOnly, {
      foreignKey: "patientId",
      targetKey: "id",
    });
  };
}
