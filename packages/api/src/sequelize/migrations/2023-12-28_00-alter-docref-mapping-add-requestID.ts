import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "docref_mapping";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "request_id",
      { type: DataTypes.STRING },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, "request_id", { transaction });
  });
};
