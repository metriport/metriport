import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "cq_directory_entry";
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
        urlXCPD: {
          type: DataTypes.STRING,
          field: "url_xcpd",
          allowNull: false,
        },
        urlDQ: {
          type: DataTypes.STRING,
          allowNull: true,
          field: "url_dq",
        },
        urlDR: {
          type: DataTypes.STRING,
          allowNull: true,
          field: "url_dr",
        },
        lat: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        lon: {
          type: DataTypes.STRING,
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
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};
