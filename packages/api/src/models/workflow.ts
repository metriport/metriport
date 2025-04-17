import {
  Workflow,
  WorkflowData,
  WorkflowParamsCx,
  WorkflowParamsOps,
} from "@metriport/shared/domain/workflow/types";
import { WorkflowStatus } from "@metriport/shared/domain/workflow/workflow-status";
import { DataTypes, Sequelize } from "sequelize";
import { BaseModel, ModelSetup } from "./_default";

/**
 * Used by code that needs to access the raw data from the database.
 * @see finishSinglePatientImport()
 */
export const workflowRawColumnNames = {
  id: "id",
  cxId: "cx_id",
  facilityId: "facility_id",
  patientId: "patient_id",
  workflowId: "workflow_id",
  requestId: "request_id",
  status: "status",
  reason: "reason",
  startedAt: "started_at",
  finishedAt: "finished_at",
  total: "total",
  successful: "successful",
  failed: "failed",
  paramsCx: "params_cx",
  paramsOps: "params_ops",
  data: "data",
};

export class WorkflowModel extends BaseModel<WorkflowModel> implements Workflow {
  static NAME = "workflow";
  declare cxId: string;
  declare patientId: string | undefined;
  declare facilityId: string | undefined;
  declare workflowId: string;
  declare requestId: string;
  declare status: WorkflowStatus;
  declare reason: string | undefined;
  declare startedAt: Date | undefined;
  declare finishedAt: Date | undefined;
  declare total: number;
  declare successful: number;
  declare failed: number;
  declare paramsCx: WorkflowParamsCx | undefined;
  declare paramsOps: WorkflowParamsOps | undefined;
  declare data: WorkflowData | undefined;

  static setup: ModelSetup = (sequelize: Sequelize) => {
    WorkflowModel.init(
      {
        ...BaseModel.attributes(),
        cxId: {
          type: DataTypes.UUID,
        },
        facilityId: {
          type: DataTypes.STRING,
        },
        patientId: {
          type: DataTypes.STRING,
        },
        workflowId: {
          type: DataTypes.STRING,
        },
        requestId: {
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
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        ...BaseModel.modelOptions(sequelize),
        tableName: WorkflowModel.NAME,
      }
    );
  };
}
