import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const patientSettingsTableName = "patient_settings";
const subscriptionsColumn = "subscriptions";
const patientSettingsTableConstraintName = "patient_settings_cxId_patientId_constraint";
const patientSettingsTableIdFields = ["cx_id", "patient_id"];

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
          type: DataTypes.STRING,
          field: "patient_id",
          allowNull: false,
          references: {
            model: "patient",
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
          allowNull: false,
        },
        subscriptions: {
          type: DataTypes.JSONB,
          field: subscriptionsColumn,
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
    await queryInterface.removeConstraint(
      patientSettingsTableName,
      patientSettingsTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.dropTable(patientSettingsTableName, { transaction });
  });
};
