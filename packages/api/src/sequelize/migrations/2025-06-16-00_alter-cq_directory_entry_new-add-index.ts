import type { Migration } from "..";

const tableName = "cq_directory_entry_new";
const indexColumnName = "managing_organization_id";
const indexName = `${tableName}_${indexColumnName}_idx`;

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(tableName, [indexColumnName], {
      name: indexName,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexName, {
      transaction,
    });
  });
};
