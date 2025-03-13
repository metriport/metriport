import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientSettingsTableName = "patient_settings";
const adtSubscriptionColumn = "subscribe_to";
const patientSettingsTableConstraintName = "patient_settings_cxId_patientId_constraint";
const patientSettingsTableIdFields = ["patient_id", "cx_id"];

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      patientSettingsTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
          allowNull: false,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
          allowNull: false,
        },
        subscribeTo: {
          type: DataTypes.JSONB,
          field: adtSubscriptionColumn,
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addConstraint(patientSettingsTableName, {
      name: patientSettingsTableConstraintName,
      fields: patientSettingsTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(patientSettingsTableName, { transaction });
    await queryInterface.removeConstraint(
      patientSettingsTableName,
      patientSettingsTableConstraintName,
      {
        transaction,
      }
    );
  });
};
