import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const resourceMappingTableName = "resource_mapping_reversed";
const resourceMappingTableConstraintName =
  "resource_mapping_reversed_cxId_ptId_ptXId_rId_constraint";
const resourceMappingTableIndexName = "resource_mapping_reversed_cxId_ptId_ptXId_rId_index";
const resourceMappingTableIdFields = [
  "cx_id",
  "patient_id",
  "patient_mapping_external_id",
  "resource_id",
];

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
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addIndex(resourceMappingTableName, {
      name: resourceMappingTableIndexName,
      fields: resourceMappingTableIdFields,
      transaction,
    });
    await queryInterface.addConstraint(resourceMappingTableName, {
      name: resourceMappingTableConstraintName,
      fields: resourceMappingTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      resourceMappingTableName,
      resourceMappingTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.removeIndex(resourceMappingTableName, resourceMappingTableIndexName, {
      transaction,
    });
    await queryInterface.dropTable(resourceMappingTableName, { transaction });
  });
};
