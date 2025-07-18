import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "tcm_encounter";
const columnName = "discharge_summary_path";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      columnName,
      {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      { transaction }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, columnName, { transaction });
  });
};
