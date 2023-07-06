import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Settings } from "../../models/settings";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      Settings.NAME,
      "webhook_key",
      { type: DataTypes.STRING },
      { transaction }
    );
    await queryInterface.addColumn(
      Settings.NAME,
      "webhook_status",
      { type: DataTypes.STRING },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(Settings.NAME, "webhook_status", {
      transaction,
    });
    await queryInterface.removeColumn(Settings.NAME, "webhook_key", {
      transaction,
    });
  });
};
