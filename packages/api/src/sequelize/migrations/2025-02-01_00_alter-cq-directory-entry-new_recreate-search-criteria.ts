import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cq_directory_entry_new";
const hieViewName = "hie_directory_view";
const cqViewName = "cq_directory_entry_view";
const columnName = "search_criteria";

const dropHieViewSql = `DROP VIEW IF EXISTS ${hieViewName};`;
const dropCqViewSql = `DROP VIEW IF EXISTS ${cqViewName};`;

const alterSearchCriteriaColumnSql = `
ALTER TABLE ${tableName} 
DROP COLUMN ${columnName},
ADD COLUMN ${columnName} tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(id, '')) || ' ' ||
  to_tsvector('english', coalesce(name, '')) || ' ' ||
  to_tsvector('english', coalesce(root_organization, '')) || ' ' ||
  to_tsvector('english', coalesce(address_line, '')) || ' ' ||
  to_tsvector('english', coalesce(city, '')) || ' ' ||
  to_tsvector('english', coalesce(state, '')) || ' ' ||
  to_tsvector('english', coalesce(zip, ''))
) STORED;
`;

const createCqViewSql = `CREATE VIEW ${cqViewName} AS SELECT * from ${tableName};`;
const createHieViewSql = `CREATE VIEW ${hieViewName} AS SELECT * from ${cqViewName};`;

export const up: Migration = async ({ context: queryInterface }) => {
  for (const sql of [
    dropHieViewSql,
    dropCqViewSql,
    alterSearchCriteriaColumnSql,
    createCqViewSql,
    createHieViewSql,
  ]) {
    await queryInterface.sequelize.query(sql, {
      type: QueryTypes.RAW,
    });
  }
};

export const down: Migration = async () => {
  console.log(
    "No down migration for 2025-02-01_00_alter-cq-directory-entry-new_recreate-search-criteria"
  );
};
