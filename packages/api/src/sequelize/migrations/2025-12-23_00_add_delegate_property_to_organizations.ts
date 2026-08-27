import { DataTypes } from "sequelize";
import type { Migration } from "..";

const organizationTableName = "organization";
const columnName = "principal_oid";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      organizationTableName,
      columnName,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(organizationTableName, columnName, { transaction });
  });
};
