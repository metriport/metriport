import { PatientSettings } from "@metriport/core/domain/patient-settings";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";

export class PatientSettingsModel
  extends BaseModel<PatientSettingsModel>
  implements PatientSettings
{
  static NAME = "patient_settings";
  declare id: string;
  declare cxId: string;
  declare patientId: string;
  declare adtSubscription: boolean;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientSettingsModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.UUID,
        },
        adtSubscription: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientSettingsModel.NAME,
      }
    );
  };
}
