import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Settings } from "../../models/settings";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      Settings.NAME,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        webhookUrl: {
          type: DataTypes.STRING,
          field: "webhook_url",
        },
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(Settings.NAME, { transaction });
  });
};
