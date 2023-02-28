import type { Migration } from "..";
import { MAPIAccess } from "../../models/medical/mapi-access";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameColumn(MAPIAccess.NAME, "cxId", "cx_id", { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.renameColumn(MAPIAccess.NAME, "cx_id", "cxId", { transaction });
  });
};
