import { DataTypes, literal } from "sequelize";
import type { Migration } from "..";

const tableName = "coverage-enhancement";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.createTable(
      tableName,
      {
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
          primaryKey: true,
        },
        ecId: {
          type: DataTypes.UUID,
          field: "ec_id",
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
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
        updatedAt: {
          field: "updated_at",
          type: DataTypes.DATE(6),
          allowNull: false,
          defaultValue: literal("CURRENT_TIMESTAMP(6)"),
        },
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};
