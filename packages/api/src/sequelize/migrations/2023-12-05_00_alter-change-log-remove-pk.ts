import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "change_log";
const pkColumnName = "id";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, pkColumnName, { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      pkColumnName,
      {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      { transaction }
    );
  });
};
