import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const secretsMappingTableName = "secrets_mapping";
const secretsMappingTableConstraintName = "secretsmapping_source_externalId_constraint";
const secretsMappingTableIndexName = "secretsmapping_source_externalId_index";
const secretsMappingTableIdFields = ["source", "external_id"];

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      secretsMappingTableName,
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
        secretArn: {
          type: DataTypes.STRING,
          field: "secret_arn",
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
    await queryInterface.addIndex(secretsMappingTableName, {
      name: secretsMappingTableIndexName,
      fields: secretsMappingTableIdFields,
      transaction,
    });
    await queryInterface.addConstraint(secretsMappingTableName, {
      name: secretsMappingTableConstraintName,
      fields: secretsMappingTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      secretsMappingTableName,
      secretsMappingTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.removeIndex(secretsMappingTableName, secretsMappingTableIndexName, {
      transaction,
    });
    await queryInterface.dropTable(secretsMappingTableName, { transaction });
  });
};
