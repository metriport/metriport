import type { Migration } from "..";

const tableName = "patient_settings";
const columnName = "subscriptions";
const indexName = "idx_patient_settings_subscriptions_gin";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE INDEX ${indexName}
    ON ${tableName} 
    USING GIN (${columnName});
  `);
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS ${indexName};
  `);
};
