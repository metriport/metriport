import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "suspect";
const indexPatientIdSuspectGroupColumns = ["patient_id", "suspect_group"];
const indexNamePatientIdSuspectGroup = `${tableName}_${indexPatientIdSuspectGroupColumns.join(
  "_"
)}_idx`;
const constraintPatientIdSuspectGroupLastRunColumns = ["patient_id", "suspect_group", "last_run"];
const constraintNamePatientIdSuspectGroupLastRun = `${tableName}_${constraintPatientIdSuspectGroupLastRunColumns.join(
  "_"
)}_constraint`;

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
    await queryInterface.addIndex(tableName, indexPatientIdSuspectGroupColumns, {
      name: indexNamePatientIdSuspectGroup,
      transaction,
    });
    await queryInterface.addConstraint(tableName, {
      name: constraintNamePatientIdSuspectGroupLastRun,
      fields: constraintPatientIdSuspectGroupLastRunColumns,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(tableName, constraintNamePatientIdSuspectGroupLastRun, {
      transaction,
    });
    await queryInterface.removeIndex(tableName, indexNamePatientIdSuspectGroup, { transaction });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
