import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "tcm_encounter";
const indexColumns = ["cx_id", "admit_time", "discharge_time"];
const indexName = `${tableName}_${indexColumns.join("_")}_idx`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
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
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
          allowNull: false,
        },
        facilityName: {
          type: DataTypes.STRING,
          field: "facility_name",
          allowNull: false,
        },
        latestEvent: {
          type: DataTypes.ENUM("Admitted", "Transferred", "Discharged"),
          field: "latest_event",
          allowNull: false,
        },
        class: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        admitTime: {
          type: DataTypes.DATE,
          field: "admit_time",
          allowNull: true,
        },
        dischargeTime: {
          type: DataTypes.DATE,
          field: "discharge_time",
          allowNull: true,
        },
        clinicalInformation: {
          type: DataTypes.JSONB,
          field: "clinical_information",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );

    await queryInterface.addIndex(tableName, indexColumns, {
      name: indexName,
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};
