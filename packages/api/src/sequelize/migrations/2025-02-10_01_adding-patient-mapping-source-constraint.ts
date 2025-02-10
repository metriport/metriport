import type { Migration } from "..";

const patientMappingTableName = "patient_mapping";
const patientMappingTableConstraintNameOld = "patient_mapping_source_externalId_constraint";
const patientMappingTableIdFieldsOld = ["source", "external_id"];
const patientMappingTableConstraintNameNew =
  "patient_mapping_source_externalId_patientId_constraint";
const patientMappingTableIdFieldsNew = ["source", "external_id", "patient_id"];

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addConstraint(patientMappingTableName, {
      name: patientMappingTableConstraintNameNew,
      fields: patientMappingTableIdFieldsNew,
      type: "unique",
      transaction,
    });
    await queryInterface.removeConstraint(
      patientMappingTableName,
      patientMappingTableConstraintNameOld,
      {
        transaction,
      }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addConstraint(patientMappingTableName, {
      name: patientMappingTableConstraintNameOld,
      fields: patientMappingTableIdFieldsOld,
      type: "unique",
      transaction,
    });
    await queryInterface.removeConstraint(
      patientMappingTableName,
      patientMappingTableConstraintNameNew,
      {
        transaction,
      }
    );
  });
};
