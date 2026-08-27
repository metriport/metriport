import { DataTypes, literal } from "sequelize";
import type { Migration } from "..";

const tableName = "ehex_patient_discovery_result";
const patientIdIndexName = "ehex_patient_discovery_result_patientid_index";
const patientIdColumnName = "patient_id";
const requestIdIndexName = "ehex_patient_discovery_result_requestid_index";
const requestIdColumnName = "request_id";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.createTable(
      tableName,
      {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          // Not making this a PK because we never query by this column
        },
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          field: "status",
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        createdAt: {
          field: "created_at",
          type: DataTypes.DATE(6),
          allowNull: false,
          defaultValue: literal("CURRENT_TIMESTAMP(6)"),
        },
      },
      { transaction }
    );
    await queryInterface.addIndex(tableName, {
      name: patientIdIndexName,
      fields: [patientIdColumnName],
      transaction,
    });
    await queryInterface.addIndex(tableName, {
      name: requestIdIndexName,
      fields: [requestIdColumnName],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, patientIdIndexName, { transaction });
    await queryInterface.removeIndex(tableName, requestIdIndexName, { transaction });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
