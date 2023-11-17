import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      "cq_directory",
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        // oid: {
        //   type: DataTypes.STRING,
        // },
        // name: {
        //   type: DataTypes.STRING,
        //   allowNull: true,
        // },
        // urlXCPD: {
        //   type: DataTypes.STRING,
        //   field: "url_xcpd",
        // },
        // urlDQ: {
        //   type: DataTypes.STRING,
        //   allowNull: true,
        //   field: "url_dq",
        // },
        // urlDR: {
        //   type: DataTypes.STRING,
        //   allowNull: true,
        //   field: "url_dr",
        // },
        // latitude: {
        //   type: DataTypes.STRING,
        //   allowNull: true,
        // },
        // longitude: {
        //   type: DataTypes.STRING,
        //   allowNull: true,
        // },
        // state: {
        //   type: DataTypes.STRING,
        //   allowNull: true,
        // },
        // data: {
        //   type: DataTypes.JSONB,
        //   allowNull: true,
        // },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        oid: {
          type: DataTypes.STRING,
        },
        organizationNumber: {
          type: DataTypes.INTEGER,
          unique: true,
          field: "organization_number",
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable("cq_directory", { transaction });
  });
};
