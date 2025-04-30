import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "patient_import_mapping";
const indexName = "patient_import_mapping_patientid_idx";
const indexFieldNames = ["patient_id"];
const constraintName = "patient_import_mapping_unique";
const constraintFieldNames = ["job_id", "row_number", "data_pipeline_request_id"];

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
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
        jobId: {
          type: DataTypes.STRING,
          field: "job_id",
          allowNull: false,
        },
        rowNumber: {
          type: DataTypes.INTEGER,
          field: "row_number",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
          allowNull: false,
        },
        dataPipelineRequestId: {
          type: DataTypes.STRING,
          field: "data_pipeline_request_id",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addConstraint(tableName, {
      name: constraintName,
      fields: constraintFieldNames,
      type: "unique",
      transaction,
    });
    await queryInterface.addIndex(tableName, {
      name: indexName,
      fields: indexFieldNames,
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexName, { transaction });
    await queryInterface.removeConstraint(tableName, constraintName, { transaction });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
