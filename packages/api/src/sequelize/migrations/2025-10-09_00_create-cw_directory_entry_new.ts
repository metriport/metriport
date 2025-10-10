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
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
};

const alterSearchCriteriaColumnSql = `
ALTER TABLE ${tableName}
ADD COLUMN ${columnName} tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(organization_id, '')) || ' ' ||
  to_tsvector('english', coalesce(organization_name, '')) || ' ' ||
  to_tsvector('english', coalesce(member_name, '')) || ' ' ||
  to_tsvector('english', coalesce(address_line1, '')) || ' ' ||
  to_tsvector('english', coalesce(city, '')) || ' ' ||
  to_tsvector('english', coalesce(state, '')) || ' ' ||
  to_tsvector('english', coalesce(zip_code, ''))
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
