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
  jobType: "job_type",
  jobGroupId: "job_group_id",
  requestId: "request_id",
  status: "status",
  statusReason: "status_reason",
  scheduledAt: "scheduled_at",
  startedAt: "started_at",
  finishedAt: "finished_at",
  cancelledAt: "cancelled_at",
  failedAt: "failed_at",
  total: "total",
  successful: "successful",
  failed: "failed",
  paramsCx: "params_cx",
  paramsOps: "params_ops",
  data: "data",
  runtimeData: "runtime_data",
};

export class PatientJobModel extends BaseModel<PatientJobModel> implements PatientJob {
  static NAME = "patient_job";
  declare cxId: string;
  declare patientId: string;
  declare jobType: string;
  declare jobGroupId: string;
  declare requestId: string | undefined;
  declare status: JobStatus;
  declare statusReason: string | undefined;
  declare scheduledAt: Date | undefined;
  declare startedAt: Date | undefined;
  declare finishedAt: Date | undefined;
  declare cancelledAt: Date | undefined;
  declare failedAt: Date | undefined;
  declare total: number;
  declare successful: number;
  declare failed: number;
  declare paramsCx: JobParamsCx | undefined;
  declare paramsOps: JobParamsOps | undefined;
  declare data: unknown;
  declare runtimeData: unknown;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    PatientJobModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        jobType: {
          type: DataTypes.STRING,
        },
        jobGroupId: {
          type: DataTypes.STRING,
        },
        requestId: {
          type: DataTypes.STRING,
        },
        status: {
          type: DataTypes.STRING,
        },
        statusReason: {
          type: DataTypes.STRING,
        },
        scheduledAt: {
          type: DataTypes.DATE,
        },
        startedAt: {
          type: DataTypes.DATE,
        },
        finishedAt: {
          type: DataTypes.DATE,
        },
        cancelledAt: {
          type: DataTypes.DATE,
        },
        failedAt: {
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
        data: {
          type: DataTypes.JSONB,
        },
        runtimeData: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: PatientJobModel.NAME,
      }
    );
  };
}
