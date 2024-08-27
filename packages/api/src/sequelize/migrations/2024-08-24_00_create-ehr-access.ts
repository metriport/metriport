import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const feedbackTableName = "feedback";
const feedbackEntryTableName = "feedback_entry";

const feedbackIndexName = "feedback_entity_id_index";
const feedbackEntryIndexName = "feedback_entry_feedback_id_index";

const largeColumnLength = 5_000;

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      feedbackTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.STRING,
          field: "cx_id",
          allowNull: false,
        },
        entityId: {
          type: DataTypes.STRING,
          field: "entity_id",
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB(),
          field: "data",
          allowNull: false,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addIndex(feedbackTableName, {
      name: feedbackIndexName,
      fields: ["entity_id"],
      transaction,
    });

    await shared.createTable(
      queryInterface,
      feedbackEntryTableName,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        feedbackId: {
          type: DataTypes.STRING,
          field: "feedback_id",
          allowNull: false,
        },
        comment: {
          type: DataTypes.STRING(largeColumnLength),
          allowNull: false,
        },
        authorName: {
          type: DataTypes.STRING,
          field: "author_name",
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addIndex(feedbackEntryTableName, {
      name: feedbackEntryIndexName,
      fields: ["feedback_id"],
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(feedbackEntryTableName, { transaction });
    await queryInterface.dropTable(feedbackTableName, { transaction });
  });
};
