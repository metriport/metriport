import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cohort";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Add description column
    await queryInterface.addColumn(
      tableName,
      "description",
      {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "",
      },
      { transaction }
    );

    // Add color column
    await queryInterface.addColumn(
      tableName,
      "color",
      {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      { transaction }
    );

    // Add settings column
    await queryInterface.addColumn(
      tableName,
      "settings",
      {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      { transaction }
    );

    // Remove the old monitoring column
    await queryInterface.removeColumn(tableName, "monitoring", { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    // Add back the monitoring column
    await queryInterface.addColumn(
      tableName,
      "monitoring",
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );

    // Remove the new columns in reverse order
    await queryInterface.removeColumn(tableName, "settings", { transaction });
    await queryInterface.removeColumn(tableName, "color", { transaction });
    await queryInterface.removeColumn(tableName, "description", { transaction });
  });
};
