import { DataTypes, QueryTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const cqViewName = "cq_directory_entry_view";
const cwTableName = "cw_directory_entry";

const hieViewName = "hie_directory_view";
const columnName = "search_criteria";

// CREATE COMMONWELL TABLE
// SEED ALL CSV DATA
// UPDATE HIE VIEW
const cwTableColumns = {
  id: {
    type: DataTypes.STRING,
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
    type: DataTypes.STRING,
    allowNull: false,
  },
  addressLine2: {
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
	to_tsvector('english', coalesce(id, '')) || ' ' ||
	to_tsvector('english', coalesce(name, '')) || ' ' ||
	to_tsvector('english', coalesce(root_organization, '')) || ' ' ||
	to_tsvector('english', coalesce(address_line, '')) || ' ' ||
	to_tsvector('english', coalesce(city, '')) || ' ' ||
	to_tsvector('english', coalesce(state, '')) || ' ' ||
	to_tsvector('english', coalesce(zip, ''))
) stored;
`;

const createHieViewSql = `CREATE OR REPLACE VIEW ${hieViewName}
AS SELECT 
name,
id as oid,
zip_code,
state,
root_organization,
managing_organization_id,
'CAREQUALITY' as network
FROM ${cqViewName}
UNION ALL
SELECT 
name,
id as oid,
zip_code,
state,
'Commonwell' as root_organization,
'0.0.0.0.0.0.0' as managing_organization_id,
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

    await queryInterface.sequelize.query(createHieViewSql, { type: QueryTypes.RAW, transaction });

    await queryInterface.bulkInsert(cwTableName, [], { transaction });
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
