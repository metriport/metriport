import type { Migration } from "..";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameTable("customer_sequence", "customer_sequence_704_20230720", {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameTable("customer_sequence_704_20230720", "customer_sequence", {
      transaction,
    });
  });
};
