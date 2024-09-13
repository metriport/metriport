import { DataTypes } from "sequelize";
import type { Migration } from "..";

const settingsTableName = "settings";
const mrFiltersColumn = "mr_filters";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      settingsTableName,
      mrFiltersColumn,
      { type: DataTypes.JSONB, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(settingsTableName, mrFiltersColumn, {
      transaction,
    });
  });
};
