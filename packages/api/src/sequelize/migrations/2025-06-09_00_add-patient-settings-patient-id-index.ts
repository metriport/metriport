import type { Migration } from "..";

const tableName = "patient_settings";
const indexName = "idx_patient_settings_patient_id";
const fieldName = "patient_id";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addIndex(tableName, {
    name: indexName,
    fields: [fieldName],
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex(tableName, indexName);
};
