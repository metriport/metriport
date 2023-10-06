import { DataTypes, QueryInterface, Transaction } from "sequelize";
import type { Migration } from "..";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

const tableName = "organization";

async function bulkUpdate(
  queryInterface: QueryInterface,
  transaction: Transaction,
  updateFn: (id: string) => string
): Promise<void> {
  const [res] = await queryInterface.sequelize.query(`select id from ${tableName}`, {
    transaction,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = (res && res.length ? (res as any[]) : []).map(r => r.id);
  for (const id of ids) {
    await queryInterface.sequelize.query(updateFn(id), { transaction });
  }
}

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "oid",
      {
        type: DataTypes.STRING,
        allowNull: true,
      },
      { transaction }
    );
    await bulkUpdate(
      queryInterface,
      transaction,
      id => `update ${tableName} set oid = '${id}', id = '${uuidv7()}' where id = '${id}'`
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await bulkUpdate(
      queryInterface,
      transaction,
      id => `update ${tableName} set id = oid where id = '${id}'`
    );
    await queryInterface.removeColumn(tableName, "oid", { transaction });
  });
};
