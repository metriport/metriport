import { DataTypes, Sequelize } from "sequelize";
import { PatientMapping, PatientMappingSource } from "../domain/patient-mapping";
import { BaseModel, ModelSetup } from "./_default";

export class PatientMappingModel extends BaseModel<PatientMappingModel> implements PatientMapping {
  static NAME = "patient_mapping";
  declare externalId: string;
  declare cxId: string;
  declare patientId: string;
  declare source: PatientMappingSource;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientMappingModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.UUID,
        },
        source: {
          type: DataTypes.STRING,
        },
        externalId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientMappingModel.NAME,
      }
    );
  };
}
