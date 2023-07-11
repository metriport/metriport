import type { Migration } from "..";
import { ConnectedUser } from "../../models/connected-user";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addIndex(ConnectedUser.NAME, ["cx_id"], {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(ConnectedUser.NAME, ["cx_id"], {
      transaction,
    });
  });
};
