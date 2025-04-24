import {
  PatientImportMapping,
  PatientImportMappingCreate,
} from "@metriport/shared/domain/patient/patient-import/mapping";
import { DataTypes, Model, Sequelize } from "sequelize";
import { BaseModel } from "../_default";

export class PatientImportMappingModel extends Model<
  PatientImportMapping,
  PatientImportMappingCreate
> {
  static NAME = "patient_import_mapping";
  declare cxId: string;
  declare jobId: string;
  declare rowNumber: number;
  declare patientId: string;
  declare dataPipelineRequestId: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initialize(sequelize: Sequelize): void {
    this.init(
      {
        ...BaseModel.attributesNoVersion(),
        cxId: {
          type: DataTypes.STRING,
        },
        jobId: {
          type: DataTypes.STRING,
        },
        rowNumber: {
          type: DataTypes.INTEGER,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        dataPipelineRequestId: {
          type: DataTypes.STRING,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientImportMappingModel.NAME,
        version: false,
      }
    );
  }
}
