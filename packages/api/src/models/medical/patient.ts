import { DataTypes, Sequelize } from "sequelize";
import { Patient, PatientData } from "@metriport/core/domain/patient";
import { BaseModel, ModelSetup } from "../_default";

export class PatientModel extends BaseModel<PatientModel> implements Patient {
  static NAME = "patient";
  declare cxId: string;
  declare facilityIds: string[];
  declare externalId?: string;
  declare hieOptOut?: boolean;
  declare data: PatientData;

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
        externalId: {
          type: DataTypes.STRING,
        },
        hieOptOut: {
          type: DataTypes.BOOLEAN,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientModel.NAME,
      }
    );
  };
}
