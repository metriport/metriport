import type { Migration } from "..";

const tableName = "patient_cohort";
const cohortTableName = "cohort";
const cohortIdColumn = "cohort_id";
const cohortIdConstraintName = `${tableName}_${cohortIdColumn}_fkey`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(tableName, cohortIdConstraintName, {
      transaction,
    });

    // Add the foreign key constraint with ON DELETE RESTRICT
    await queryInterface.addConstraint(tableName, {
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
    // Remove the CASCADE constraint
    await queryInterface.removeConstraint(tableName, cohortIdConstraintName, {
      transaction,
    });

    // Add back the original foreign key constraint without CASCADE
    await queryInterface.addConstraint(tableName, {
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
