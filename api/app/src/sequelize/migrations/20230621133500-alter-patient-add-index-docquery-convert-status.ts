import { Sequelize } from "sequelize";
import type { Migration } from "..";

const tableName = "patient";
const downloadIndexName = "patient_docquery_download_status_index";
const convertIndexName = "patient_docquery_convert_status_index";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // https://github.com/sequelize/sequelize/issues/5155#issuecomment-417189558
    await queryInterface.addIndex(tableName, {
      name: downloadIndexName,
      fields: [Sequelize.literal("((data->'documentQueryProgress'->'download'->>'status'))")],
      transaction,
    });
    await queryInterface.addIndex(tableName, {
      name: convertIndexName,
      fields: [Sequelize.literal("((data->'documentQueryProgress'->'convert'->>'status'))")],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, convertIndexName, { transaction });
    await queryInterface.removeIndex(tableName, downloadIndexName, { transaction });
  });
};
