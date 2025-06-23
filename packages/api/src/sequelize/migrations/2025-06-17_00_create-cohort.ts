import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const cohortTableName = "cohort";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      cohortTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        monitoring: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(cohortTableName, { transaction });
  });
};
