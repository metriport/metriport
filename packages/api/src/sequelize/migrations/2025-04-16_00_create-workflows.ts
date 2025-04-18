import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const workflowTableName = "workflow";
const workflowTableIdFields = ["cx_id", "patient_id", "facility_id", "workflow_id", "request_id"];
const workflowTableConstraintName = "cxid_patientid_facilityid_workflowid_requestid_constraint";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      workflowTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
          allowNull: true,
        },
        facilityId: {
          type: DataTypes.STRING,
          field: "facility_id",
          allowNull: true,
        },
        workflowId: {
          type: DataTypes.STRING,
          field: "workflow_id",
          allowNull: false,
        },
        requestId: {
          type: DataTypes.STRING,
          field: "request_id",
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        reason: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        startedAt: {
          type: DataTypes.DATE,
          field: "started_at",
          allowNull: true,
        },
        finishedAt: {
          type: DataTypes.DATE,
          field: "finished_at",
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
          field: "params_cx",
          allowNull: true,
        },
        paramsOps: {
          type: DataTypes.JSONB,
          field: "params_ops",
          allowNull: true,
        },
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addConstraint(workflowTableName, {
      name: workflowTableConstraintName,
      fields: workflowTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

// Note: this won't reintroduce the data, just recreate the table
export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(workflowTableName, { transaction });
  });
};
