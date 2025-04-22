import { JobParamsCx, JobParamsOps, JobStatus, PatientJob } from "@metriport/shared";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";

/**
 * Used by code that needs to access the raw data from the database.
 * @see updatePatientJobTotals()
 */
export const patientJobRawColumnNames = {
  id: "id",
  cxId: "cx_id",
  patientId: "patient_id",
  jobTypeId: "job_type_id",
  jobGroupId: "job_group_id",
  requestId: "request_id",
  status: "status",
  statusReason: "status_reason",
  startedAt: "started_at",
  finishedAt: "finished_at",
  total: "total",
  successful: "successful",
  failed: "failed",
  paramsCx: "params_cx",
  paramsOps: "params_ops",
  data: "data",
};

export class PatientJobModel extends BaseModel<PatientJobModel> implements PatientJob {
  static NAME = "patient_job";
  declare cxId: string;
  declare patientId: string;
  declare jobTypeId: string;
  declare jobGroupId: string;
  declare requestId: string;
  declare status: JobStatus;
  declare statusReason: string | undefined;
  declare startedAt: Date | undefined;
  declare finishedAt: Date | undefined;
  declare total: number;
  declare successful: number;
  declare failed: number;
  declare paramsCx: JobParamsCx | undefined;
  declare paramsOps: JobParamsOps | undefined;
  declare data: unknown;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientJobModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        jobTypeId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        jobGroupId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        requestId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        statusReason: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        finishedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        total: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        successful: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        failed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        paramsCx: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        paramsOps: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientJobModel.NAME,
      }
    );
  };
}
