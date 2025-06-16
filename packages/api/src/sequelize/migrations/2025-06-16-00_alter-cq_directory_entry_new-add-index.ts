import type { Migration } from "..";

const tableName = "cq_directory_entry_new";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(tableName, ["managing_organization_id"], {
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, ["managing_organization_id"], {
      transaction,
    });
  });
};
