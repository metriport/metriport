import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cq_directory_entry_new";
const hieViewName = "hie_directory_view";
const cqViewName = "cq_directory_entry_view";
const columnName = "search_criteria";

const createSearchCriteriaColumnSql = `
alter table ${tableName}
add ${columnName} tsvector
generated always as	(
	to_tsvector('english', coalesce(id, '')) || ' ' ||
	to_tsvector('english', coalesce(name, '')) || ' ' ||
	to_tsvector('english', coalesce(root_organization, '')) || ' ' ||
	to_tsvector('english', coalesce(address_line, '')) || ' ' ||
	to_tsvector('english', coalesce(city, '')) || ' ' ||
	to_tsvector('english', coalesce(state, '')) || ' ' ||
	to_tsvector('english', coalesce(zip, ''))
) stored;
`;

const createGinIndexSql = `
CREATE INDEX IF NOT EXISTS ${tableName}_${columnName}_idx
ON ${tableName}
USING gin(${columnName});
`;

const dropCqViewSql = `DROP VIEW IF EXISTS ${cqViewName};`;
const createCqViewSql = `CREATE VIEW ${cqViewName} AS SELECT * from ${tableName};`;
const createHieViewSql = `CREATE VIEW ${hieViewName} AS SELECT * from ${cqViewName};`;

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  for (const sql of [
    createSearchCriteriaColumnSql,
    createGinIndexSql,
    dropCqViewSql,
    createCqViewSql,
    createHieViewSql,
  ]) {
    await queryInterface.sequelize.query(sql, {
      type: QueryTypes.RAW,
    });
  }
};

const dropSearchCriteriaColumnSql = `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName};`;
const dropHieViewSql = `DROP VIEW IF EXISTS ${hieViewName};`;

export const down: Migration = async ({ context: queryInterface }) => {
  for (const sql of [dropHieViewSql, dropCqViewSql, dropSearchCriteriaColumnSql, createCqViewSql]) {
    await queryInterface.sequelize.query(sql, {
      type: QueryTypes.RAW,
    });
  }
};
