import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const hieViewName = "hie_directory_view";
const cqViewName = "cq_directory_entry_view";
const cwTableName = "cw_directory_entry";

const dropHieViewSql = `DROP VIEW IF EXISTS ${hieViewName};`;

const createHieViewSql = `
CREATE VIEW ${hieViewName} AS 
SELECT 
  name,
  id,
  id as oid,
  zip as zip_code,
  state,
  root_organization,
  managing_organization_id,
  search_criteria,
  'CAREQUALITY' as network
FROM ${cqViewName} cq

UNION ALL

SELECT 
  organization_name as name,
  organization_id as id,
  organization_id as oid,
  zip_code,
  state,
  'CommonWell' as root_organization,
  '2.16.840.1.113883.3.3330' as managing_organization_id,
  search_criteria,
  'COMMONWELL' as network
FROM ${cwTableName} cw
-- No duplicates! Exclude orgs that already exist in the Carequality view
WHERE NOT EXISTS (
  SELECT 1 
  FROM ${cqViewName} cq 
  WHERE cq.id = cw.organization_id
)
;`;

export const up: Migration = async ({ context: queryInterface }) => {
  for (const sql of [dropHieViewSql, createHieViewSql]) {
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
