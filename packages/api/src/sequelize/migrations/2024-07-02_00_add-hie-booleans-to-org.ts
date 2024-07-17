import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "organization";
const cqActiveColumn = "cq_active";
const cwActiveColumn = "cw_active";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      cqActiveColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      cwActiveColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, cwActiveColumn, { transaction });
    await queryInterface.removeColumn(tableName, cqActiveColumn, { transaction });
  });
};
