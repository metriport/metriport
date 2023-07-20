import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "document_reference";
const constraintName = "document_reference_patient_id_source_external_id_key";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "deleted_at",
      {
        type: DataTypes.DATE(6),
        allowNull: true,
      },
      { transaction }
    );
    await queryInterface.removeConstraint(tableName, constraintName, { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addConstraint(tableName, {
      transaction,
      type: "unique",
      name: constraintName,
      fields: ["patient_id", "source", "external_id"],
    });
    await queryInterface.removeColumn(tableName, "deleted_at", { transaction });
  });
};
