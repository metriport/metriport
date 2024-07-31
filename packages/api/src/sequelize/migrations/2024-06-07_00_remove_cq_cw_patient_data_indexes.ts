import type { Migration } from "..";

const cwTableName = "cw_patient_data";
const cwIndexToCreate = "cw_patient_data_id_index";
const cwIndexToCreateFieldName = "id";
const cqTableName = "cq_patient_data";
const cqIndexToCreate = "cq_patient_data_id_index";
const cqIndexToCreateFieldName = "id";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(cqTableName, cqIndexToCreate, { transaction });
    await queryInterface.removeIndex(cwTableName, cwIndexToCreate, { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(cwTableName, {
      name: cwIndexToCreate,
      fields: [cwIndexToCreateFieldName],
      transaction,
    });
    await queryInterface.addIndex(cqTableName, {
      name: cqIndexToCreate,
      fields: [cqIndexToCreateFieldName],
      transaction,
    });
  });
};
