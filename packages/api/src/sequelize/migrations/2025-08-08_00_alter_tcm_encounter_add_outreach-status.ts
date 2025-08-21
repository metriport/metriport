import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "tcm_encounter";
const columnName = "outreach_status";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      columnName,
      {
        type: DataTypes.ENUM("Not Started", "Attempted", "Completed"),
        defaultValue: "Not Started",
        allowNull: false,
      },
      { transaction }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, columnName, { transaction });
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_${tableName}_${columnName}";`, {
      transaction,
    });
  });
};
