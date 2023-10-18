/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataTypes, Sequelize, Transaction } from "sequelize";
import type { Migration } from "..";
import { Config } from "../../shared/config";

const OID_ID_START = 100;
const tableName = "customer_sequence";
const dataTypes = ["organization", "facility", "patient"] as const;
type DataType = (typeof dataTypes)[number];

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.createTable(
      tableName,
      {
        id: { type: DataTypes.STRING, primaryKey: true },
        dataType: { type: DataTypes.STRING, primaryKey: true, field: "data_type" },
        sequence: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true },
      },
      { transaction }
    );

    for (const dataType of dataTypes) {
      const cxIDs =
        dataType === "organization"
          ? [Config.getSystemRootOID()]
          : await getCxIDs(queryInterface.sequelize, dataType, transaction);
      for (const cxId of cxIDs) {
        const maxSeq = await getMaxSeq(queryInterface.sequelize, cxId, dataType, transaction);
        const currSeq = getSeq(maxSeq);
        const nextSeq = currSeq ? currSeq + 1 : OID_ID_START;
        await queryInterface.sequelize.query(
          `insert into ${tableName} (id, data_type, sequence) ` +
            `values ('${cxId}', '${dataType}', ${nextSeq})`,
          { transaction }
        );
      }
    }
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(tableName, { transaction });
  });
};

async function getCxIDs(
  sequelize: Sequelize,
  dataType: DataType,
  transaction: Transaction
): Promise<string[]> {
  const [res] = await sequelize.query(
    `select distinct cx_id from (` +
      `select cx_id from organization ` +
      `where cx_id::text not in (` +
      `  select id from ${tableName} where data_type = '${dataType}'` +
      `) ` +
      `union all ` +
      `select cx_id from connected_user ` +
      `where cx_id::text not in (` +
      `  select id from ${tableName} where data_type = '${dataType}'` +
      `)) x`,
    { transaction }
  );
  return res && res.length ? (res as any[]).map(r => r.cx_id) : [];
}

async function getMaxSeq(
  sequelize: Sequelize,
  cxId: string,
  dataType: DataType,
  transaction: Transaction
): Promise<string> {
  let tableName: string;
  let filterByCustomer = false;
  switch (dataType) {
    case "organization":
      tableName = "organization";
      break;
    case "facility":
      tableName = "facility";
      filterByCustomer = true;
      break;
    case "patient":
      tableName = "patient";
      filterByCustomer = true;
      break;
    default:
      throw new Error(`Invalid data type: ${dataType}`);
  }
  const [res] = await sequelize.query(
    `select max("id") from "${tableName}" ${filterByCustomer ? `where cx_id = '${cxId}'` : ""}`,
    { transaction }
  );
  return res && res.length ? (res[0] as any)["max"] : undefined;
}

function getSeq(id: string | undefined): number | undefined {
  if (!id) return undefined;
  const parts = id.split(".");
  if (!parts || parts.length <= 0) return undefined;
  return Number(parts[parts.length - 1]);
}
