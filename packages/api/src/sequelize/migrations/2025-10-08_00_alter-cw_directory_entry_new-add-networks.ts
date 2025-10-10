import { DataTypes, QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cw_directory_entry_new";
const cwDirectoryEntryView = "cw_directory_entry_view";
const columnName = "search_criteria";

const alterSearchCriteriaColumnSql = `
ALTER TABLE ${tableName}
ADD COLUMN ${columnName} tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(id, '')) || ' ' ||
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
    await queryInterface.addColumn(
      tableName,
      "networks",
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.addColumn(
      tableName,
      "active",
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      { transaction }
    );

    await queryInterface.addColumn(
      tableName,
      "npi",
      {
        type: DataTypes.STRING,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.sequelize.query(alterSearchCriteriaColumnSql, {
      type: QueryTypes.RAW,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`DROP VIEW IF EXISTS ${cwDirectoryEntryView};`, {
      transaction,
    });
    await queryInterface.removeColumn(tableName, "networks", { transaction });
    await queryInterface.removeColumn(tableName, "active", { transaction });
    await queryInterface.removeColumn(tableName, "npi", { transaction });
    await queryInterface.removeColumn(tableName, "search_criteria", { transaction });
    await queryInterface.addColumn(
      tableName,
      "status",
      {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Active",
      },
      { transaction }
    );
  });
};
