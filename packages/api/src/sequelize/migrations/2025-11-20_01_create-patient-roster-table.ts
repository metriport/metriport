import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const rosterTableName = "roster";
const patientTableName = "patient";
const patientRosterTableName = "patient_roster";

const rosterIdColumn = "roster_id";
const patientIdColumn = "patient_id";
const rosterIdIndex = `${patientRosterTableName}_${rosterIdColumn}_idx`;
const patientIdRosterIdConstraintName = `${patientRosterTableName}_${patientIdColumn}_${rosterIdColumn}_unique_constraint`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      patientRosterTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        patientId: {
          type: DataTypes.STRING,
          allowNull: false,
          field: "patient_id",
          references: {
            model: patientTableName,
            key: "id",
          },
          onDelete: "CASCADE",
        },
        rosterId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: "roster_id",
          references: {
            model: rosterTableName,
            key: "id",
          },
        },
      },
      {
        transaction,
        addVersion: true,
      }
    );

    await queryInterface.addConstraint(patientRosterTableName, {
      fields: [patientIdColumn, rosterIdColumn],
      type: "unique",
      name: patientIdRosterIdConstraintName,
      transaction,
    });

    await queryInterface.addIndex(patientRosterTableName, {
      name: rosterIdIndex,
      fields: [rosterIdColumn],
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(patientRosterTableName, rosterIdIndex, { transaction });
    await queryInterface.removeConstraint(patientRosterTableName, patientIdRosterIdConstraintName, {
      transaction,
    });
    await queryInterface.dropTable(patientRosterTableName, { transaction });
  });
};
