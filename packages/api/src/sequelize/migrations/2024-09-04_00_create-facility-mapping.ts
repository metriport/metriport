import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const facilityMappingTableName = "facility_mapping";
const facilityMappingTableConstraintName = "facility_mapping_source_externalId_constraint";
const facilityMappingTableIndexName = "facility_mapping_source_externalId_index";
const facilityMappingTableIdFields = ["source", "external_id"];

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      facilityMappingTableName,
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
        facilityId: {
          type: DataTypes.STRING,
          field: "facility_id",
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
    await queryInterface.addIndex(facilityMappingTableName, {
      name: facilityMappingTableIndexName,
      fields: facilityMappingTableIdFields,
      transaction,
    });
    await queryInterface.addConstraint(facilityMappingTableName, {
      name: facilityMappingTableConstraintName,
      fields: facilityMappingTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      facilityMappingTableName,
      facilityMappingTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.removeIndex(facilityMappingTableName, facilityMappingTableIndexName, {
      transaction,
    });
    await queryInterface.dropTable(facilityMappingTableName, { transaction });
  });
};
