import { DataTypes, Sequelize } from "sequelize";
import { Patient, PatientData } from "../../domain/medical/patient";
import { BaseModel, ModelSetup } from "../_default";

export class PatientModel extends BaseModel<PatientModel> implements Patient {
  static NAME = "patient";
  declare cxId: string;
  declare facilityIds: string[];
  declare data: PatientData;
  declare cxRequestMetadata: Record<string, string | undefined>; // New field

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.STRING),
        },
        data: {
          type: DataTypes.JSONB,
        },
        cxRequestMetadata: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientModel.NAME,
      }
    );
  };
}
