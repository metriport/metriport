import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const jobTableName = "patient_import";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      jobTableName,
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
        facilityId: {
          type: DataTypes.STRING,
          field: "facility_id",
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
          allowNull: false,
        },
        paramsOps: {
          type: DataTypes.JSONB,
          field: "params_ops",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(jobTableName, { transaction });
  });
};
