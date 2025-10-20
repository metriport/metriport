import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "cq_directory_entry";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};

// Note: this won't reintroduce the data, just recreate the table
export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
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
        state: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        lastUpdatedAtCQ: {
          field: "last_updated_at_cq",
          type: DataTypes.STRING,
          allowNull: true,
        },
        createdAt: {
          field: "created_at",
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          field: "updated_at",
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        managingOrganization: {
          field: "managing_organization",
          type: DataTypes.STRING,
          allowNull: true,
        },
        managingOrganizationId: {
          field: "managing_organization_id",
          type: DataTypes.STRING,
          allowNull: true,
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
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
        zip: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
  });
};
