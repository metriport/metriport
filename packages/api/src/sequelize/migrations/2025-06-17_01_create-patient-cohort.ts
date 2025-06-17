import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientTableName = "patient";
const cohortTableName = "cohort";
const patientCohortTableName = "patient_cohort";

const cohortIdColumn = "cohort_id";
const patientIdColumn = "patient_id";
const cohortIdIndex = `${patientCohortTableName}_${cohortIdColumn}_idx`;
// const patientCohortIndex = `${patientCohortTableName}_${cohortIdColumn}_${patientIdColumn}_idx`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      patientCohortTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          allowNull: false,
          field: "patient_id",
          references: {
            model: patientTableName,
            key: "id",
          },
          onDelete: "CASCADE",
        },
        cohortId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: "cohort_id",
          references: {
            model: cohortTableName,
            key: "id",
          },
          onDelete: "CASCADE",
        },
      },
      {
        transaction,
        addVersion: true,
      }
    );

    await queryInterface.addConstraint(patientCohortTableName, {
      fields: [patientIdColumn, cohortIdColumn],
      type: "unique",
      name: `${patientCohortTableName}_${patientIdColumn}_${cohortIdColumn}_unique`,
      transaction,
    });

    return queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addIndex(patientCohortTableName, {
        name: cohortIdIndex,
        fields: [cohortIdColumn],
        transaction,
      });
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(patientCohortTableName, { transaction });
  });
};
