import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const cxMappingTableName = "cx_mapping";
const cxMappingTableIndexName = "cx_mapping_source_externalId_index";
const cxMappingTableIndexFields = ["source", "externalId"];
const patientMappingTableName = "patient_mapping";
const patientMappingTableIndexName = "patient_mapping_source_externalId_index";
const patientMappingTableIndexFields = ["source", "externalId"];
const jwtTokenTableName = "jwt_token";
const jwtTokenTableIndexName = "patient_mapping_source_token_index";
const jwtTokenTableIndexFields = ["source", "token"];

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      cxMappingTableName,
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
    await shared.createTable(
      queryInterface,
      patientMappingTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
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
    await shared.createTable(
      queryInterface,
      jwtTokenTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        token: {
          type: DataTypes.STRING,
          field: "token",
          allowNull: false,
        },
        exp: {
          type: DataTypes.DATE,
          field: "exp",
          allowNull: false,
        },
        source: {
          type: DataTypes.STRING,
          field: "source",
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addIndex(cxMappingTableName, {
      name: cxMappingTableIndexName,
      fields: cxMappingTableIndexFields,
      transaction,
    });
    await queryInterface.addIndex(patientMappingTableName, {
      name: patientMappingTableIndexName,
      fields: patientMappingTableIndexFields,
      transaction,
    });
    await queryInterface.addIndex(jwtTokenTableName, {
      name: jwtTokenTableIndexName,
      fields: jwtTokenTableIndexFields,
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(jwtTokenTableName, jwtTokenTableIndexName, { transaction });
    await queryInterface.removeIndex(patientMappingTableName, patientMappingTableIndexName, {
      transaction,
    });
    await queryInterface.removeIndex(cxMappingTableName, cxMappingTableIndexName, { transaction });
    await queryInterface.dropTable(jwtTokenTableName, { transaction });
    await queryInterface.dropTable(patientMappingTableName, { transaction });
    await queryInterface.dropTable(cxMappingTableName, { transaction });
  });
};
