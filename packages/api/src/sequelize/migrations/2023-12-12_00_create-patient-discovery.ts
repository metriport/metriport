import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "patient_discovery_result";

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
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
        },
        status: {
          type: DataTypes.STRING,
          field: "status",
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};
