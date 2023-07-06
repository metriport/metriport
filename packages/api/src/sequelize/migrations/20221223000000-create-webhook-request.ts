import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Settings } from "../../models/settings";
import { WebhookRequest } from "../../models/webhook-request";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      Settings.NAME,
      "webhook_enabled",
      { type: DataTypes.BOOLEAN },
      { transaction }
    );
    await queryInterface.sequelize.query("UPDATE settings SET webhook_enabled=false", {
      transaction,
    });
    await queryInterface.changeColumn(
      Settings.NAME,
      "webhook_enabled",
      { type: DataTypes.BOOLEAN, allowNull: false },
      { transaction }
    );
    await queryInterface.renameColumn(Settings.NAME, "webhook_status", "webhook_status_detail", {
      transaction,
    });
    await shared.createTable(
      queryInterface,
      WebhookRequest.NAME,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          allowNull: false,
        },
        payload: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameColumn(Settings.NAME, "webhook_status_detail", "webhook_status", {
      transaction,
    });
    await queryInterface.removeColumn(Settings.NAME, "webhook_enabled", {
      transaction,
    });
    await queryInterface.dropTable(WebhookRequest.NAME, { transaction });
  });
};
