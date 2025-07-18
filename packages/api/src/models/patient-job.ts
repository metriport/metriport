import { JobParamsCx, JobParamsOps, JobStatus, PatientJob } from "@metriport/shared";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";

export class PatientJobModel extends BaseModel<PatientJobModel> implements PatientJob {
  static NAME = "patient_job";
  declare cxId: string;
  declare patientId: string;
  declare jobType: string;
  declare jobGroupId: string;
  declare requestId: string | undefined;
  declare status: JobStatus;
  declare statusReason: string | undefined;
  declare runUrl: string | undefined;
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
        runUrl: {
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
