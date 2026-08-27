import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "datasource_query";

/**
 * Makes specific_source a required field by adding NOT NULL constraint.
 * Assumes all existing rows already have specific_source populated.
 */

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Add NOT NULL constraint
    await queryInterface.sequelize.query(
      `ALTER TABLE ${tableName} ALTER COLUMN specific_source SET NOT NULL`,
      { type: QueryTypes.RAW, transaction }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Remove NOT NULL constraint
    await queryInterface.sequelize.query(
      `ALTER TABLE ${tableName} ALTER COLUMN specific_source DROP NOT NULL`,
      { type: QueryTypes.RAW, transaction }
    );
  });
};
