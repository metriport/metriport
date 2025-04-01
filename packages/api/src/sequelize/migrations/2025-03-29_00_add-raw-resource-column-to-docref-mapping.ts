import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "docref_mapping";
const columnName = "raw_resource";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn(tableName, columnName, {
    type: DataTypes.JSONB,
    defaultValue: "{}",
    allowNull: false,
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return await queryInterface.removeColumn(tableName, columnName);
};
