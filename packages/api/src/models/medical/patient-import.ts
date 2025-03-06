import {
  PatientImport,
  PatientImportParams,
  PatientImportStatus,
} from "@metriport/shared/domain/patient/patient-import/types";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

export class PatientImportModel extends BaseModel<PatientImportModel> implements PatientImport {
  static NAME = "patient_import";
  declare cxId: string;
  declare facilityId: string;
  declare status: PatientImportStatus;
  declare reason: string | undefined;
  declare startedAt: Date | undefined;
  declare finishedAt: Date | undefined;
  declare total: number | undefined;
  declare successful: number | undefined;
  declare failed: number | undefined;
  declare params: PatientImportParams;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientImportModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        facilityId: {
          type: DataTypes.STRING,
        },
        status: {
          type: DataTypes.STRING,
        },
        reason: {
          type: DataTypes.STRING,
        },
        startedAt: {
          type: DataTypes.DATE,
        },
        finishedAt: {
          type: DataTypes.DATE,
        },
        total: {
          type: DataTypes.INTEGER,
        },
        successful: {
          type: DataTypes.INTEGER,
        },
        failed: {
          type: DataTypes.INTEGER,
        },
        params: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientImportModel.NAME,
      }
    );
  };
}
