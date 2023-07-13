import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { ConnectedUser } from "../../models/connected-user";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.createFunction(
      shared.updateUpdatedAtFnName,
      [],
      "trigger",
      "plpgsql",
      `NEW.updated_at = CURRENT_TIMESTAMP(6); RETURN NEW;\n`,
      undefined,
      { transaction }
    );
    await shared.createTable(
      queryInterface,
      ConnectedUser.NAME,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        cxUserId: {
          type: DataTypes.STRING,
          field: "cx_user_id",
        },
        providerMap: {
          type: DataTypes.JSONB,
          field: "provider_map",
        },
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(ConnectedUser.NAME, { transaction });
    await queryInterface.dropFunction(shared.updateUpdatedAtFnName, [], {
      transaction,
    });
  });
};
