import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/status";
import {
  PatientImport,
  PatientImportParamsCx,
  PatientImportParamsOps,
} from "@metriport/shared/domain/patient/patient-import/types";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "../_default";

/**
 * Used by code that needs to access the raw data from the database.
 * @see finishSinglePatientImport()
 */
export const patientImportRawColumnNames = {
  id: "id",
  cxId: "cx_id",
  facilityId: "facility_id",
  status: "status",
  reason: "reason",
  startedAt: "started_at",
  finishedAt: "finished_at",
  total: "total",
  successful: "successful",
  failed: "failed",
  paramsCx: "params_cx",
  paramsOps: "params_ops",
};

export class PatientImportModel extends BaseModel<PatientImportModel> implements PatientImport {
  static NAME = "patient_import";
  declare cxId: string;
  declare facilityId: string;
  declare status: PatientImportStatus;
  declare reason: string | undefined;
  declare startedAt: Date | undefined;
  declare finishedAt: Date | undefined;
  declare total: number;
  declare successful: number;
  declare failed: number;
  declare paramsCx: PatientImportParamsCx;
  declare paramsOps: PatientImportParamsOps;

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
        paramsCx: {
          type: DataTypes.JSONB,
        },
        paramsOps: {
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
