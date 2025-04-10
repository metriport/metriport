import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const resourceMappingTableName = "resource_mapping_reversed";
const resourceMappingTableConstraintName =
  "resource_mapping_reversed_cxId_ptId_ptXId_rId_constraint";
const resourceMappingTableIdFields = [
  "cx_id",
  "patient_id",
  "patient_mapping_external_id",
  "resource_id",
];

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

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      resourceMappingTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
          allowNull: false,
        },
        patientMappingExternalId: {
          type: DataTypes.STRING,
          field: "patient_mapping_external_id",
          allowNull: false,
        },
        resourceId: {
          type: DataTypes.STRING,
          field: "resource_id",
          allowNull: false,
        },
        source: {
          type: DataTypes.STRING,
          field: "source",
          allowNull: false,
        },
        externalId: {
          type: DataTypes.STRING,
          field: "external_id",
          allowNull: true,
        },
        isMapped: {
          type: DataTypes.BOOLEAN,
          field: "is_mapped",
          allowNull: false,
          defaultValue: false,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addConstraint(resourceMappingTableName, {
      name: resourceMappingTableConstraintName,
      fields: resourceMappingTableIdFields,
      type: "unique",
      transaction,
    });
    await queryInterface.removeIndex(jwtTokenTableName, jwtTokenTableIndexName, { transaction });
    await queryInterface.removeIndex(patientMappingTableName, patientMappingTableIndexName, {
      transaction,
    });
    await queryInterface.removeIndex(cxMappingTableName, cxMappingTableIndexName, { transaction });
    await queryInterface.addIndex(patientMappingTableName, {
      name: patientMappingTablePatientIdIndexName,
      fields: patientMappingTablePatientIdFields,
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(
      patientMappingTableName,
      patientMappingTablePatientIdIndexName,
      {
        transaction,
      }
    );
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
    await queryInterface.removeConstraint(
      resourceMappingTableName,
      resourceMappingTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.dropTable(resourceMappingTableName, { transaction });
  });
};
