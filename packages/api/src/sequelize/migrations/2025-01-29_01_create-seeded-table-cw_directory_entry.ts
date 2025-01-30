import { DataTypes, QueryTypes, Sequelize } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const cqViewName = "cq_directory_entry_view";
const cwTableName = "cw_directory_entry";

const hieViewName = "hie_directory_view";
const columnName = "search_criteria";

const cwTableColumns = {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.literal("gen_random_uuid()"),
    primaryKey: true,
    allowNull: false,
  },
  organizationName: {
    field: "organization_name",
    type: DataTypes.STRING,
    allowNull: false,
  },
  organizationId: {
    field: "organization_id",
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  orgType: {
    field: "org_type",
    type: DataTypes.STRING,
    allowNull: false,
  },
  memberName: {
    field: "member_name",
    type: DataTypes.STRING,
    allowNull: false,
  },
  addressLine1: {
    field: "address_line1",
    type: DataTypes.STRING,
    allowNull: false,
  },
  addressLine2: {
    field: "address_line2",
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  zipCode: {
    field: "zip_code",
    type: DataTypes.STRING,
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
  },
};

const createSearchCriteriaColumnSql = `
alter table ${cwTableName}
add ${columnName} tsvector
generated always as	(
	to_tsvector('english', id::text) || ' ' ||
	to_tsvector('english', coalesce(organization_id, '')) || ' ' ||
	to_tsvector('english', coalesce(organization_name, '')) || ' ' ||
	to_tsvector('english', 'Commonwell') || ' ' ||
	to_tsvector('english', coalesce(state, '')) || ' ' ||
	to_tsvector('english', coalesce(zip_code, ''))
) stored;
`;

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
FROM ${cqViewName}

UNION ALL

SELECT 
  organization_name as name,
  organization_id as id,
  organization_id as oid,
  zip_code,
  state,
  'Commonwell' as root_organization,
  '2.16.840.1.113883.3.3330' as managing_organization_id,
  search_criteria,
  'COMMONWELL' as network
FROM ${cwTableName}
;`;

const dropHieViewSql = `DROP VIEW IF EXISTS ${hieViewName};`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(queryInterface, cwTableName, cwTableColumns, {
      transaction,
      addVersion: true,
    });

    await queryInterface.sequelize.query(createSearchCriteriaColumnSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    await queryInterface.sequelize.query(dropHieViewSql, { type: QueryTypes.RAW, transaction });
    await queryInterface.sequelize.query(createHieViewSql, { type: QueryTypes.RAW, transaction });
  });
};

const createOldHieViewSql = `CREATE VIEW ${hieViewName} AS SELECT * from ${cqViewName};`;

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(dropHieViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    await queryInterface.dropTable(cwTableName, { transaction });

    await queryInterface.sequelize.query(createOldHieViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });
  });
};
