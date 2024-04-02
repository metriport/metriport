import { Sequelize } from "sequelize";
import type { Migration } from "..";

const tableName = "patient";
const indexName = "patient_dob_index";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // https://github.com/sequelize/sequelize/issues/5155#issuecomment-417189558
    await queryInterface.addIndex(tableName, {
      name: indexName,
      fields: [Sequelize.literal("((data->>'dob'))")],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexName, { transaction });
  });
};
