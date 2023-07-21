import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { MAPIAccess } from "../../models/medical/mapi-access";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      MAPIAccess.NAME,
      {
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          primaryKey: true,
        },
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(MAPIAccess.NAME, { transaction });
  });
};
