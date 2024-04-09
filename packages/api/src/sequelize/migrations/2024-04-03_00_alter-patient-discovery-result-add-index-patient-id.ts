import type { Migration } from "..";

const tableName = "patient_discovery_result";
const indexToCreate = "patient_discovery_result_patientid_index";
const indexToCreateFieldName = "patient_id";
const constraintToRemove = "patient_discovery_result_pkey";
const constraintToRemoveFieldName = "id";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(tableName, constraintToRemove, {
      transaction,
    });
    await queryInterface.addIndex(tableName, {
      name: indexToCreate,
      fields: [indexToCreateFieldName],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexToCreate, { transaction });
    await queryInterface.addIndex(tableName, {
      name: constraintToRemove,
      fields: [constraintToRemoveFieldName],
      transaction,
    });
  });
};
