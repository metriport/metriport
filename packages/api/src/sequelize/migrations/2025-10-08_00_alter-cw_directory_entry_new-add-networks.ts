import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cw_directory_entry_new";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "networks",
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.addColumn(
      tableName,
      "active",
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      { transaction }
    );

    await queryInterface.removeColumn(tableName, "status", { transaction });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, "networks", { transaction });
    await queryInterface.removeColumn(tableName, "active", { transaction });
    await queryInterface.addColumn(
      tableName,
      "status",
      {
        type: DataTypes.STRING,
        allowNull: false,
      },
      { transaction }
    );
  });
};
