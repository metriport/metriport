import { DataTypes } from "sequelize";
import type { Migration } from "..";

const columnName = "version";
const columnDef = {
  allowNull: false,
  type: DataTypes.INTEGER,
  defaultValue: 0,
};

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    return Promise.all([
      queryInterface.addColumn("connected_user", columnName, columnDef, { transaction }),
      queryInterface.addColumn("settings", columnName, columnDef, { transaction }),
      queryInterface.addColumn("webhook_request", columnName, columnDef, { transaction }),
      queryInterface.addColumn("mapi_access", columnName, columnDef, { transaction }),
      queryInterface.addColumn("organization", columnName, columnDef, { transaction }),
      queryInterface.addColumn("facility", columnName, columnDef, { transaction }),
      queryInterface.addColumn("patient", columnName, columnDef, { transaction }),
    ]);
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    return Promise.all([
      queryInterface.removeColumn("patient", columnName, { transaction }),
      queryInterface.removeColumn("facility", columnName, { transaction }),
      queryInterface.removeColumn("organization", columnName, { transaction }),
      queryInterface.removeColumn("mapi_access", columnName, { transaction }),
      queryInterface.removeColumn("webhook_request", columnName, { transaction }),
      queryInterface.removeColumn("settings", columnName, { transaction }),
      queryInterface.removeColumn("connected_user", columnName, { transaction }),
    ]);
  });
};
