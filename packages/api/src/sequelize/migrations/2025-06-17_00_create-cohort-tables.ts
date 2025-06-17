import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientTableName = "patient";
const cohortTableName = "cohort";
const cohortAssignmentTableName = "patient_cohort";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Cohort table
    await shared.createTable(
      queryInterface,
      cohortTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        monitoring: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        otherSettings: {
          type: DataTypes.JSONB,
          field: "other_settings",
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
  });

  // Cohort assignment table
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      cohortAssignmentTableName,
      {
        patient_id: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: patientTableName,
            key: "id",
          },
          onDelete: "CASCADE",
        },
        cohort_id: {
          type: DataTypes.UUID,
          allowNull: false,
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

    await queryInterface.addConstraint(cohortAssignmentTableName, {
      fields: ["cohort_id", "patient_id"],
      type: "primary key",
      name: "pk_patient_cohort",
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(cohortTableName, { transaction });
    await queryInterface.dropTable(cohortAssignmentTableName, { transaction });
  });
};
