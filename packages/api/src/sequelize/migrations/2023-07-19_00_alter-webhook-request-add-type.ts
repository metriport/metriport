import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "webhook_request";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(tableName, "type", { type: DataTypes.STRING }, { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, "type", { transaction });
  });
};
