import { DataTypes } from "sequelize";
import type { Migration } from "..";

const patientJobTableName = "patient_job";
const patientJobScheduledAtColumn = "scheduled_at";
const patientJobCancelledAtColumn = "cancelled_at";
const patientJobFailedAtColumn = "failed_at";
const patientJobRuntimeDataColumn = "runtime_data";
const patientJobRunUrlColumn = "run_url";
const patientJobStatusIndexColumn = "status";
const patientJobStatusIndex = "patient_job_status_idx";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      patientJobTableName,
      patientJobScheduledAtColumn,
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      patientJobTableName,
      patientJobCancelledAtColumn,
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      patientJobTableName,
      patientJobFailedAtColumn,
      { type: DataTypes.DATE, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      patientJobTableName,
      patientJobRuntimeDataColumn,
      { type: DataTypes.JSONB, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      patientJobTableName,
      patientJobRunUrlColumn,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addIndex(patientJobTableName, [patientJobStatusIndexColumn], {
      transaction,
      name: patientJobStatusIndex,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(patientJobTableName, patientJobStatusIndex, {
      transaction,
    });
    await queryInterface.removeColumn(patientJobTableName, patientJobRunUrlColumn, {
      transaction,
    });
    await queryInterface.removeColumn(patientJobTableName, patientJobRuntimeDataColumn, {
      transaction,
    });
    await queryInterface.removeColumn(patientJobTableName, patientJobFailedAtColumn, {
      transaction,
    });
    await queryInterface.removeColumn(patientJobTableName, patientJobCancelledAtColumn, {
      transaction,
    });
    await queryInterface.removeColumn(patientJobTableName, patientJobScheduledAtColumn, {
      transaction,
    });
  });
};
