import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "facility";
const columnName = "facility_number";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, columnName, { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      columnName,
      { type: DataTypes.INTEGER },
      { transaction }
    );
  });
};
