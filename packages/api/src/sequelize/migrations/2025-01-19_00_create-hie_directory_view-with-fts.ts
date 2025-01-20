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
const createHieViewSql = `CREATE VIEW ${hieViewName} AS SELECT * from cq_directory_entry_view;`;

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await Promise.all(
      [
        createSearchCriteriaColumnSql,
        createGinIndexSql,
        dropCqViewSql,
        createCqViewSql,
        createHieViewSql,
      ].map(sql =>
        queryInterface.sequelize.query(sql, {
          type: QueryTypes.RAW,
          transaction,
        })
      )
    );
  });
};

const dropSearchCriteriaColumnSql = `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`;
const dropHieViewSql = `DROP VIEW IF EXISTS ${hieViewName};`;

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await Promise.all(
      [dropHieViewSql, dropCqViewSql, dropSearchCriteriaColumnSql, createCqViewSql].map(sql =>
        queryInterface.sequelize.query(sql, {
          type: QueryTypes.RAW,
          transaction,
        })
      )
    );
  });
};
