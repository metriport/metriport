import type { Migration } from "..";
import cwData from "./data/00_seed-table-cw_directory_entry/cw-export_2025-01-28.json";

const cwTableName = "cw_directory_entry";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.bulkInsert(cwTableName, cwData as object[], { transaction });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.bulkDelete(cwTableName, [], { transaction });
  });
};
