import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "docref_mapping";
const externalIdColumn = "external_id";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      externalIdColumn,
      {
        type: DataTypes.STRING(319),
        allowNull: false,
      },
      { transaction }
    );
  });
};

export const down: Migration = () => {
  // No rollback for column size increase due to large data volume
  // Rolling back would require table rewrite which is risky with large amounts of data
  return Promise.resolve();
};
