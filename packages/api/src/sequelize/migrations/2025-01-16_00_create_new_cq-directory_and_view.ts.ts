import { DataTypes, QueryTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "cq_directory_entry_new";
const viewName = "cq_directory_entry_view";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
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
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        urlXCPD: {
          field: "url_xcpd",
          type: DataTypes.STRING,
          allowNull: true,
        },
        urlDQ: {
          field: "url_dq",
          type: DataTypes.STRING,
          allowNull: true,
        },
        urlDR: {
          field: "url_dr",
          type: DataTypes.STRING,
          allowNull: true,
        },
        addressLine: {
          type: DataTypes.STRING,
          field: "address_line",
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
          type: DataTypes.STRING,
          allowNull: true,
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
        lastUpdatedAtCQ: {
          field: "last_updated_at_cq",
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );

    const sql = `CREATE VIEW ${viewName} AS SELECT * from ${tableName};`;
    await queryInterface.sequelize.query(sql, {
      type: QueryTypes.RAW,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  const sql = `DROP VIEW ${viewName};`;
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(sql, {
      type: QueryTypes.RAW,
      transaction,
    });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
