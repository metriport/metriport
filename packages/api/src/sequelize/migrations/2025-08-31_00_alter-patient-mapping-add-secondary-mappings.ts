import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "patient_mapping";
const column = "secondary_mappings";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      column,
      { type: DataTypes.JSONB, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, column, { transaction });
  });
};
