import type { Migration } from "..";

// TODO 1343 - remove this migration before moving the PR from draft to ready
// TODO 1343 - remove this migration before moving the PR from draft to ready
// TODO 1343 - remove this migration before moving the PR from draft to ready

const tableName = "some_table_name_for_testing";
const newTableName = "non-existing-table";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameTable(newTableName, tableName, {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameTable(newTableName, tableName, {
      transaction,
    });
  });
};
