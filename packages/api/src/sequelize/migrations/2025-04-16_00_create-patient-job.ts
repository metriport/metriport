import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientJobTableName = "patient_job";
const patientJobTableIndexFields = ["cx_id", "patient_id"];
const patientJobTableIndexName = "cxid_patientid_index";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      patientJobTableName,
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
          allowNull: false,
        },
        jobType: {
          type: DataTypes.STRING,
          field: "job_type",
          allowNull: false,
        },
        jobGroupId: {
          type: DataTypes.STRING,
          field: "job_group_id",
          allowNull: false,
        },
        requestId: {
          type: DataTypes.STRING,
          field: "request_id",
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        statusReason: {
          type: DataTypes.STRING,
          field: "status_reason",
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
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addIndex(patientJobTableName, {
      name: patientJobTableIndexName,
      fields: patientJobTableIndexFields,
      transaction,
    });
  });
};

// Note: this won't reintroduce the data, just recreate the table
export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(patientJobTableName, patientJobTableIndexFields, {
      name: patientJobTableIndexName,
      transaction,
    });
    await queryInterface.dropTable(patientJobTableName, { transaction });
  });
};
