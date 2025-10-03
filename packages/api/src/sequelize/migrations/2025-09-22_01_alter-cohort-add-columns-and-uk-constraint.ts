import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cohort";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
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

    await queryInterface.addColumn(
      tableName,
      "color",
      {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      { transaction }
    );

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

    await queryInterface.addConstraint(tableName, {
      fields: ["cx_id", "name"],
      type: "unique",
      name: `uk_${tableName}_cx_id_name`,
      transaction,
    });

    await queryInterface.removeColumn(tableName, "monitoring", { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "monitoring",
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.removeConstraint(tableName, `uk_${tableName}_cx_id_name`, { transaction });
    await queryInterface.removeColumn(tableName, "settings", { transaction });
    await queryInterface.removeColumn(tableName, "color", { transaction });
    await queryInterface.removeColumn(tableName, "description", { transaction });
  });
};
