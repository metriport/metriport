import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const rosterTableName = "roster";
const indexColumnName = "cx_id";
const indexName = `${rosterTableName}_${indexColumnName}_idx`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      rosterTableName,
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
        source: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        type: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addIndex(rosterTableName, [indexColumnName], {
      name: indexName,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(rosterTableName, indexName, { transaction });
    await queryInterface.dropTable(rosterTableName, { transaction });
  });
};
