import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientSettingsTableName = "patient_settings";
const adtSubscriptionColumn = "adt_subscription";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      patientSettingsTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
          allowNull: false,
        },
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          allowNull: false,
        },
        adtSubscription: {
          type: DataTypes.BOOLEAN,
          field: adtSubscriptionColumn,
          allowNull: false,
          defaultValue: false,
        },
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(patientSettingsTableName, { transaction });
  });
};
