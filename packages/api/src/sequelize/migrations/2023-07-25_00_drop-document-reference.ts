import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "document-reference";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      "document_reference",
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
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
        externalId: {
          type: DataTypes.STRING,
          field: "external_id",
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      {
        transaction,
        addVersion: true,
        uniqueKeys: { external_unique: { fields: ["patient_id", "source", "external_id"] } },
      }
    );
  });
};
