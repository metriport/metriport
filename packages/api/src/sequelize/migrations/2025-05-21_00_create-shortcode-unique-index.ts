import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "organization";
const indexName = "idx_organizations_shortcode_unique";

export const up: Migration = async ({ context: queryInterface }) => {
  const sql = `
    CREATE UNIQUE INDEX ${indexName} 
    ON ${tableName} ((data->>'shortcode'))
    WHERE data->>'shortcode' IS NOT NULL;
  `;

  await queryInterface.sequelize.query(sql, {
    type: QueryTypes.RAW,
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  const sql = `DROP INDEX IF EXISTS ${indexName};`;
  await queryInterface.sequelize.query(sql, {
    type: QueryTypes.RAW,
  });
};
