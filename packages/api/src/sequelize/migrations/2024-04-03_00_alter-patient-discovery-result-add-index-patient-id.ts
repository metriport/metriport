import type { Migration } from "..";

const tableName = "patient_discovery_result";
const indexName = "patient_discovery_result_patientid_index";
const fieldName = "patient_id";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(tableName, {
      name: indexName,
      fields: [fieldName],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexName, { transaction });
  });
};
