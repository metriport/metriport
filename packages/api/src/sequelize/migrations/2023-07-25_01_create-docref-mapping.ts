import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "docref_mapping";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        externalId: {
          type: DataTypes.STRING,
          field: "external_id",
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        patientId: {
          type: DataTypes.STRING,
          field: "patient_id",
        },
        source: {
          type: DataTypes.STRING,
        },
      },
      {
        transaction,
        addVersion: true,
        uniqueKeys: {
          external_unique: { fields: ["external_id", "patient_id", "cx_id", "source"] },
        },
      }
    );
    await queryInterface.addIndex(tableName, ["cx_id", "patient_id", "source"], {
      name: tableName + "_alternative_unique_idx",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};
