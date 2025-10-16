import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const hieViewName = "hie_directory_view";
const cqViewName = "cq_directory_entry_view";
const cwViewName = "cw_directory_entry_view";

const dropHieViewSql = `DROP VIEW IF EXISTS ${hieViewName};`;

const createHieViewSql = `
CREATE VIEW ${hieViewName} AS

SELECT
  name,
  oid as id,
  oid,
  zip as zip_code,
  state,
  root_organization,
  managing_organization_id,
  search_criteria,
  'COMMONWELL' as network
FROM ${cwViewName} cw

UNION ALL

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

-- No duplicates! Exclude orgs that already exist in the CommonWell view
WHERE NOT EXISTS (
  SELECT 1
  FROM ${cqViewName} cq
  WHERE cq.id = cw.oid
)
;`;

export const up: Migration = async ({ context: queryInterface }) => {
  for (const sql of [dropHieViewSql, createHieViewSql]) {
    await queryInterface.sequelize.query(sql, {
      type: QueryTypes.RAW,
    });
  }
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(dropHieViewSql, {
    type: QueryTypes.RAW,
  });
};
