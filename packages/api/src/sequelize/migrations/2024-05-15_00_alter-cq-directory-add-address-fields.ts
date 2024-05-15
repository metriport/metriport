import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cq_directory_entry";
const addressLineColumn = "address_line";
const cityColumn = "city";
const zipColumn = "zip";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      addressLineColumn,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      cityColumn,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      zipColumn,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, addressLineColumn, { transaction });
    await queryInterface.removeColumn(tableName, cityColumn, { transaction });
    await queryInterface.removeColumn(tableName, zipColumn, { transaction });
  });
};
