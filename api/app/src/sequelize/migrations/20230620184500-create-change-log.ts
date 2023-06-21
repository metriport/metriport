import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "change_log";
const changeTriggerName = "change_trigger";

function getChangeTriggerCreateCmd(): string {
  return (
    `CREATE OR REPLACE FUNCTION ${changeTriggerName}() RETURNS trigger AS $$ ` +
    "BEGIN " +
    "IF      TG_OP = 'INSERT' " +
    "THEN " +
    `    INSERT INTO ${tableName} (table_name, operation, created_at, who, new_val) ` +
    "        VALUES (TG_RELNAME, TG_OP, current_timestamp, current_user, row_to_json(NEW)); " +
    "        RETURN NEW; " +
    "ELSIF   TG_OP = 'UPDATE' " +
    "THEN " +
    `    INSERT INTO ${tableName} (table_name, operation, created_at, who, new_val, old_val) ` +
    "        VALUES (TG_RELNAME, TG_OP, current_timestamp, current_user, row_to_json(NEW), row_to_json(OLD)); " +
    "    RETURN NEW; " +
    "ELSIF   TG_OP = 'DELETE' " +
    "THEN " +
    `    INSERT INTO ${tableName} (table_name, operation, created_at, who, old_val) ` +
    "        VALUES (TG_RELNAME, TG_OP, current_timestamp, current_user, row_to_json(OLD)); " +
    "    RETURN OLD; " +
    "END IF; " +
    "END; " +
    "$$ LANGUAGE 'plpgsql' SECURITY DEFINER"
  );
}

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
      {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
        tableName: {
          field: "table_name",
          type: DataTypes.STRING,
          allowNull: false,
        },
        operation: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          field: "created_at",
          type: DataTypes.STRING,
          allowNull: false,
        },
        who: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        oldVal: {
          field: "old_val",
          type: DataTypes.JSONB,
          allowNull: false,
        },
        newVal: {
          field: "new_val",
          type: DataTypes.JSONB,
          allowNull: false,
        },
      },
      { transaction }
    );
    await queryInterface.sequelize.query(getChangeTriggerCreateCmd(), { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropFunction(changeTriggerName, [], { transaction });
    await queryInterface.dropTable(tableName, { transaction });
  });
};
