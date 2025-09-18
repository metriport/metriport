import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "suspect";
const indexColumns = ["cx_id", "suspect_group"];
const indexName = `${tableName}_${indexColumns.join("_")}_idx`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
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
        suspectGroup: {
          type: DataTypes.STRING,
          field: "suspect_group",
          allowNull: false,
        },
        suspectIcd10Code: {
          type: DataTypes.STRING,
          field: "suspect_icd10_code",
          allowNull: false,
        },
        suspectIcd10ShortDescription: {
          type: DataTypes.STRING,
          field: "suspect_icd10_short_description",
          allowNull: false,
        },
        responsibleResources: {
          type: DataTypes.JSONB,
          field: "responsible_resources",
          allowNull: true,
        },
        lastRun: {
          type: DataTypes.DATE,
          field: "last_run",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );

    await queryInterface.addIndex(tableName, indexColumns, {
      name: indexName,
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};
