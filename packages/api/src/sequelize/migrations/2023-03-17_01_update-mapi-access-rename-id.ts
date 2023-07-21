import type { Migration } from "..";
import { MAPIAccess } from "../../models/medical/mapi-access";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameColumn(MAPIAccess.NAME, "cx_id", "id", { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameColumn(MAPIAccess.NAME, "id", "cx_id", { transaction });
  });
};
