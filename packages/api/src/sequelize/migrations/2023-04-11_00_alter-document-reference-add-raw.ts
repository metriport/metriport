import { DataTypes } from "sequelize";
import type { Migration } from "..";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      "document_reference",
      "raw",
      { type: DataTypes.JSONB, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn("document_reference", "raw", { transaction });
  });
};
