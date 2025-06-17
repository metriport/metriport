import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientTableName = "patient";
const cohortTableName = "cohort";
const patientCohortTableName = "patient_cohort";
const pkName = `${patientCohortTableName}_patient_id_cohort_id_pkey`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      patientCohortTableName,
      {
        patient_id: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: patientTableName,
            key: "id",
          },
        },
        cohort_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: cohortTableName,
            key: "id",
          },
        },
      },
      {
        transaction,
        addVersion: true,
      }
    );

    await queryInterface.addConstraint(patientCohortTableName, {
      fields: ["cohort_id", "patient_id"],
      type: "primary key",
      name: pkName,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(patientCohortTableName, { transaction });
  });
};
