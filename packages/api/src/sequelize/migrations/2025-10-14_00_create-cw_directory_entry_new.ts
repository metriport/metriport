import { DataTypes, QueryTypes, Sequelize } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "cw_directory_entry_new";
const cwDirectoryEntryView = "cw_directory_entry_view";
const columnName = "search_criteria";

const cwTableColumns = {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.literal("gen_random_uuid()"),
    primaryKey: true,
    allowNull: false,
  },
  name: {
    field: "name",
    type: DataTypes.STRING,
    allowNull: false,
  },
  oid: {
    field: "oid",
    type: DataTypes.STRING,
    allowNull: false,
  },
  npi: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  orgType: {
    field: "org_type",
    type: DataTypes.STRING,
    allowNull: false,
  },
  rootOrganization: {
    field: "root_organization",
    type: DataTypes.STRING,
    allowNull: false,
  },
  addressLine: {
    field: "address_line",
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
  },
  state: {
    type: DataTypes.STRING,
  },
  zip: {
    field: "zip",
    type: DataTypes.STRING,
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
};

const alterSearchCriteriaColumnSql = `
ALTER TABLE ${tableName}
ADD COLUMN ${columnName} tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(oid, '')) || ' ' ||
  to_tsvector('english', coalesce(name, '')) || ' ' ||
  to_tsvector('english', coalesce(root_organization, '')) || ' ' ||
  to_tsvector('english', coalesce(address_line, '')) || ' ' ||
  to_tsvector('english', coalesce(city, '')) || ' ' ||
  to_tsvector('english', coalesce(state, '')) || ' ' ||
  to_tsvector('english', coalesce(zip, ''))
) STORED;
`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(queryInterface, tableName, cwTableColumns, {
      transaction,
      addVersion: true,
    });

    await queryInterface.sequelize.query(alterSearchCriteriaColumnSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    await queryInterface.sequelize.query(
      `CREATE VIEW ${cwDirectoryEntryView} AS SELECT * FROM ${tableName};`,
      {
        type: QueryTypes.RAW,
        transaction,
      }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`DROP VIEW IF EXISTS ${cwDirectoryEntryView};`, {
      transaction,
    });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
