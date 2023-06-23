import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "change_log";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      "old_val",
      { type: DataTypes.JSONB, allowNull: true },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      "new_val",
      { type: DataTypes.JSONB, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      "old_val",
      { type: DataTypes.JSONB, allowNull: false },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      "new_val",
      { type: DataTypes.JSONB, allowNull: false },
      { transaction }
    );
  });
};
