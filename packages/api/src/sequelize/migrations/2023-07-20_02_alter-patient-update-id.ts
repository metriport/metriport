import { DataTypes, QueryInterface, Transaction } from "sequelize";
import type { Migration } from "..";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

const tableName = "patient";

function queryFacilityIdsUp(patientId: string): string {
  return `
    select id from facility 
    where old_id in (
      select unnest(facility_ids) from patient 
      where id = '${patientId}'
    )
  `;
}
function queryFacilityIdsDown(patientId: string): string {
  return `
    select old_id as id from facility 
    where id in (
      select unnest(facility_ids) from patient 
      where id = '${patientId}'
    )
  `;
}

async function bulkUpdate(
  queryInterface: QueryInterface,
  transaction: Transaction,
  updateFn: (id: string, facilityIds: string[]) => string,
  queryFacilityIdsFn: (id: string) => string
): Promise<void> {
  const [res] = await queryInterface.sequelize.query(`select id from ${tableName}`, {
    transaction,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = (res && res.length ? (res as any[]) : []).map(r => r.id);
  for (const id of ids) {
    const [res] = await queryInterface.sequelize.query(queryFacilityIdsFn(id), { transaction });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facilityIds = res.map((r: any) => r["id"]) as string[];
    await queryInterface.sequelize.query(updateFn(id, facilityIds), { transaction });
  }
}

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "old_id",
      { type: DataTypes.STRING },
      { transaction }
    );
    await bulkUpdate(
      queryInterface,
      transaction,
      (id, facilityIds) => `
        update ${tableName} set 
          old_id = '${id}', 
          facility_ids = '{${facilityIds.join(",")}}', 
          id = '${uuidv7()}' 
        where id = '${id}'
      `,
      queryFacilityIdsUp
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await bulkUpdate(
      queryInterface,
      transaction,
      (id, facilityIds) => `
        update ${tableName} set 
          id = old_id, 
          facility_ids = '{${facilityIds.join(",")}}'
        where id = '${id}'
      `,
      queryFacilityIdsDown
    );
    await queryInterface.removeColumn(tableName, "old_id", { transaction });
  });
};
