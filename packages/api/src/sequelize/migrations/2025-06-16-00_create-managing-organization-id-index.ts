import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cq_directory_entry_new";
const indexName = "idx_managing_organization_id";

export const up: Migration = async ({ context: queryInterface }) => {
  const sql = `
    CREATE INDEX ${indexName} 
    ON ${tableName} (managing_organization_id)
    WHERE managing_organization_id IS NOT NULL;
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
