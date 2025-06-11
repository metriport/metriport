import { DataTypes } from "sequelize";
import type { Migration } from "..";

const patientJobTableName = "patient_job";
const patientJobScheduledAtColumn = "scheduled_at";
const patientJobCancelledAtColumn = "cancelled_at";
const patientJobFailedAtColumn = "failed_at";
const patientJobRuntimeDataColumn = "runtime_data";

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
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
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
