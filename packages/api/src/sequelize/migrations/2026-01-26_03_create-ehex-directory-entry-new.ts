import { DataTypes, QueryTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "ehex_directory_entry_new";
const ehexDirectoryEntryView = "ehex_directory_entry_view";
const searchCriteriaColumnName = "search_criteria";

const ehexTableColumns = {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    field: "name",
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
  rootOrganization: {
    field: "root_organization",
    type: DataTypes.STRING,
    allowNull: true,
  },
  managingOrganizationId: {
    field: "managing_organization_id",
    type: DataTypes.STRING,
    allowNull: true,
  },
  urlXcpd: {
    type: DataTypes.STRING,
    field: "url_xcpd",
    allowNull: true,
  },
  urlDq: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "url_dq",
  },
  urlDr: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "url_dr",
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  lon: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  point: {
    type: "CUBE",
    allowNull: true,
  },
  addressLine: {
    field: "address_line",
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  zip: {
    field: "zip",
    type: DataTypes.STRING,
    allowNull: true,
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  lastUpdatedAtEhex: {
    type: DataTypes.STRING,
    allowNull: true,
    field: "last_updated_at_ehex",
  },
};

const alterSearchCriteriaColumnSql = `
ALTER TABLE ${tableName}
ADD COLUMN ${searchCriteriaColumnName} tsvector
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

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(queryInterface, tableName, ehexTableColumns, {
      transaction,
      addVersion: true,
    });

    await queryInterface.sequelize.query(alterSearchCriteriaColumnSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    await queryInterface.sequelize.query(
      `CREATE VIEW ${ehexDirectoryEntryView} AS SELECT * FROM ${tableName};`,
      {
        type: QueryTypes.RAW,
        transaction,
      }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`DROP VIEW IF EXISTS ${ehexDirectoryEntryView};`, {
      transaction,
    });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
