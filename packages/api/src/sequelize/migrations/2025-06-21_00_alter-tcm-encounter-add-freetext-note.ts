import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "tcm_encounter";
const columnName = "freetext_note";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      columnName,
      {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "",
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
