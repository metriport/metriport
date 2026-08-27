import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "care_gap";
const constraintPatientIdMeasureNameJobIdColumns = ["patient_id", "measure_name", "job_id"];
const constraintNamePatientIdMeasureNameJobId = `${tableName}_${constraintPatientIdMeasureNameJobIdColumns.join(
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
        jobId: {
          type: DataTypes.STRING,
          field: "job_id",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
          allowNull: false,
        },
        measureName: {
          type: DataTypes.STRING,
          field: "measure_name",
          allowNull: false,
        },
        measureReport: {
          type: DataTypes.JSONB,
          field: "measure_report",
          allowNull: false,
        },
        supportingEvidence: {
          type: DataTypes.JSONB,
          field: "supporting_evidence",
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
      name: constraintNamePatientIdMeasureNameJobId,
      fields: constraintPatientIdMeasureNameJobIdColumns,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(tableName, constraintNamePatientIdMeasureNameJobId, {
      transaction,
    });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
