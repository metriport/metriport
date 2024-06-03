import type { Migration } from "..";

const tableName = "patient_discovery_result";
const createdAtIndex = "patient_discovery_result_createdat_index";
const createdAtIndexFieldName = "created_at";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(tableName, {
      name: createdAtIndex,
      fields: [createdAtIndexFieldName],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, createdAtIndex, { transaction });
  });
};
