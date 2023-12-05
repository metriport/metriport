import { Sequelize } from "sequelize";
import type { Migration } from "..";

const tableName = "change_log";
const indexName = "change_log_data_id_idx";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(tableName, {
      name: indexName,
      fields: [Sequelize.literal("(\"new_val\"->>'id')")],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexName, { transaction });
  });
};
