import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const feedbackTableName = "ehr_access";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      feedbackTableName,
      {
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          allowNull: false,
        },
        ehrId: {
          type: DataTypes.STRING,
          field: "ehr_id",
          allowNull: false,
        },
        ehrName: {
          type: DataTypes.STRING,
          field: "ehr_name",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(feedbackTableName, { transaction });
  });
};
