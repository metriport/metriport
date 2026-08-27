import type { Migration } from "..";

const patientCohortTableName = "patient_cohort";
const cohortTableName = "cohort";
const cohortIdColumn = "cohort_id";
const cohortIdConstraintName = `${patientCohortTableName}_${cohortIdColumn}_fkey`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(patientCohortTableName, cohortIdConstraintName, {
      transaction,
    });

    await queryInterface.addConstraint(patientCohortTableName, {
      fields: [cohortIdColumn],
      type: "foreign key",
      name: cohortIdConstraintName,
      references: {
        table: cohortTableName,
        field: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(patientCohortTableName, cohortIdConstraintName, {
      transaction,
    });

    await queryInterface.addConstraint(patientCohortTableName, {
      fields: [cohortIdColumn],
      type: "foreign key",
      name: cohortIdConstraintName,
      references: {
        table: cohortTableName,
        field: "id",
      },
      onDelete: "NO ACTION",
      onUpdate: "CASCADE",
      transaction,
    });
  });
};
