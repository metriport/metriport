import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "suspect";
const constraintPatientIdGroupLastRunColumns = ["patient_id", "group", "last_run"];
const constraintNamePatientIdGroupLastRun = `${tableName}_${constraintPatientIdGroupLastRunColumns.join(
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
        group: {
          type: DataTypes.STRING,
          field: "group",
          allowNull: false,
        },
        icd10Code: {
          type: DataTypes.STRING,
          field: "icd10_code",
          allowNull: true,
        },
        icd10ShortDescription: {
          type: DataTypes.STRING,
          field: "icd10_short_description",
          allowNull: true,
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
    await queryInterface.addConstraint(tableName, {
      name: constraintNamePatientIdGroupLastRun,
      fields: constraintPatientIdGroupLastRunColumns,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(tableName, constraintNamePatientIdGroupLastRun, {
      transaction,
    });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
