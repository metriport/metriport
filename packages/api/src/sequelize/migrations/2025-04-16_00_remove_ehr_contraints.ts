import type { Migration } from "..";

const cxMappingTableName = "cx_mapping";
const cxMappingTableIndexName = "cx_mapping_source_externalId_index";
const cxMappingTableIdFields = ["source", "external_id"];
const patientMappingTableName = "patient_mapping";
const patientMappingTableIndexName = "patient_mapping_source_externalId_index";
const patientMappingTablePatientIdIndexName = "patient_mapping_patientId_index";
const patientMappingTableIdFields = ["source", "external_id"];
const patientMappingTablePatientIdFields = ["patient_id"];
const jwtTokenTableName = "jwt_token";
const jwtTokenTableIndexName = "patient_mapping_source_token_index";
const jwtTokenTableIdFields = ["source", "token"];

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(patientMappingTableName, {
      name: patientMappingTablePatientIdIndexName,
      fields: patientMappingTablePatientIdFields,
      transaction,
    });
    await queryInterface.removeIndex(jwtTokenTableName, jwtTokenTableIndexName, { transaction });
    await queryInterface.removeIndex(patientMappingTableName, patientMappingTableIndexName, {
      transaction,
    });
    await queryInterface.removeIndex(cxMappingTableName, cxMappingTableIndexName, { transaction });
  });
};

// Note: this won't reintroduce the data, just recreate the table
export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(cxMappingTableName, {
      name: cxMappingTableIndexName,
      fields: cxMappingTableIdFields,
      transaction,
    });
    await queryInterface.addIndex(patientMappingTableName, {
      name: patientMappingTableIndexName,
      fields: patientMappingTableIdFields,
      transaction,
    });
    await queryInterface.addIndex(jwtTokenTableName, {
      name: jwtTokenTableIndexName,
      fields: jwtTokenTableIdFields,
      transaction,
    });
    await queryInterface.removeIndex(
      patientMappingTableName,
      patientMappingTablePatientIdIndexName,
      {
        transaction,
      }
    );
  });
};
