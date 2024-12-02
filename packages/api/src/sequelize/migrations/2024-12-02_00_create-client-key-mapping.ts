import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const clientKeyMappingTableName = "client_key_mapping";
const clientKeyMappingTableConstraintName = "client_keymapping_source_externalId_constraint";
const clientKeyMappingTableIndexName = "client_keymapping_source_externalId_index";
const clientKeyMappingTableIdFields = ["source", "external_id"];

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      clientKeyMappingTableName,
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
        clientSecret: {
          type: DataTypes.STRING,
          field: "client_secret",
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: true,
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
    await queryInterface.addIndex(clientKeyMappingTableName, {
      name: clientKeyMappingTableIndexName,
      fields: clientKeyMappingTableIdFields,
      transaction,
    });
    await queryInterface.addConstraint(clientKeyMappingTableName, {
      name: clientKeyMappingTableConstraintName,
      fields: clientKeyMappingTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      clientKeyMappingTableName,
      clientKeyMappingTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.removeIndex(clientKeyMappingTableName, clientKeyMappingTableIndexName, {
      transaction,
    });
    await queryInterface.dropTable(clientKeyMappingTableName, { transaction });
  });
};
