import { DataTypes, literal } from "sequelize";
import type { Migration } from "..";

const tableName = "patient_discovery_result";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.createTable(
      tableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
        },
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
        },
        status: {
          type: DataTypes.STRING,
          field: "status",
        },
        data: {
          type: DataTypes.JSONB,
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

    await queryInterface.addIndex(tableName, ["request_id"], { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, ["request_id"], { transaction });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
