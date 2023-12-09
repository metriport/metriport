import type { Migration } from "..";

// TODO 1343 - remove this migration before moving the PR from draft to ready
// TODO 1343 - remove this migration before moving the PR from draft to ready
// TODO 1343 - remove this migration before moving the PR from draft to ready

const tableName = "some_table_name_for_testing";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`insert into ${tableName} (id) values ('1')`, {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`delete from ${tableName}`, { transaction });
  });
};
