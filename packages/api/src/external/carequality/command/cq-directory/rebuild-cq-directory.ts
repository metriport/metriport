import { Organization } from "@medplum/fhirtypes";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { initDbPool } from "@metriport/core/util/sequelize";
import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { addUpdatedAtTrigger } from "../../../../sequelize/migrations-shared";
import { Config } from "../../../../shared/config";
import { makeCarequalityManagementAPI } from "../../api";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";
import { CachedCqOrgLoader } from "../cq-organization/get-cq-organization-cached";
import { getParentOid } from "../cq-organization/get-parent-org";
import { parseCQOrganization } from "../cq-organization/parse-cq-organization";
import { bulkInsertCQDirectoryEntries } from "./create-cq-directory-entry";

dayjs.extend(duration);
const BATCH_SIZE = 1000;
const parallelQueriesToGetManagingOrg = 20;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });
const cqDirectoryEntryTemp = `cq_directory_entry_temp`;
const cqDirectoryEntry = `cq_directory_entry_new`;
const cqDirectoryEntryBackup = `cq_directory_entry_backup`;

const dbCreds = Config.getDBCreds();
const sequelize = initDbPool(dbCreds, {
  max: 10,
  min: 1,
  acquire: 30000,
  idle: 10000,
});

export async function rebuildCQDirectory(failGracefully = false): Promise<void> {
  const { log } = out("rebuildCQDirectory");
  let currentPosition = 0;
  let isDone = false;
  const cq = makeCarequalityManagementAPI();
  if (!cq) throw new Error("Carequality API not initialized");

  try {
    await createTempCQDirectoryTable();
    const cache = new CachedCqOrgLoader();
    while (!isDone) {
      try {
        const orgs = await cq.listOrganizations({ start: currentPosition, count: BATCH_SIZE });
        if (orgs.length < BATCH_SIZE) isDone = true; // if CQ directory returns less than BATCH_SIZE number of orgs, that means we've hit the end
        currentPosition += BATCH_SIZE;
        await cache.populate(orgs);
        const parentIds = orgs.flatMap(org => getParentOid(org) ?? []);
        await cache.populateByOids(parentIds);
        const parsedOrgs: CQDirectoryEntryData2[] = [];
        await executeAsynchronously(
          orgs,
          async (org: Organization) => {
            const parsed = await parseCQOrganization(org, cache);
            if (parsed) parsedOrgs.push(parsed);
          },
          { numberOfParallelExecutions: parallelQueriesToGetManagingOrg }
        );
        log(
          `Adding ${parsedOrgs.length} CQ directory entries... Total fetched: ${currentPosition}`
        );
        await bulkInsertCQDirectoryEntries(sequelize, parsedOrgs, cqDirectoryEntryTemp);
        await sleep(SLEEP_TIME.asMilliseconds());
      } catch (error) {
        isDone = true;
        if (!failGracefully) {
          throw error;
        }
      }
    }
  } catch (error) {
    await deleteTempCQDirectoryTable();
    const msg = `Failed to rebuild the directory`;
    log(`${msg}, Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context: `rebuildCQDirectory`, error },
    });
    throw error;
  }
  try {
    await renameCQDirectoryTablesAndUpdateIndexes();
    log("CQ directory successfully rebuilt! :)");
  } catch (error) {
    const msg = `Failed the last step of CQ directory rebuild`;
    await deleteTempCQDirectoryTable();
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context: `renameCQDirectoryTablesAndUpdateIndexes`, error },
    });
    throw error;
  }
}

async function createTempCQDirectoryTable(): Promise<void> {
  await deleteTempCQDirectoryTable();
  const query = `CREATE TABLE IF NOT EXISTS ${cqDirectoryEntryTemp} (LIKE ${cqDirectoryEntry} INCLUDING ALL)`;
  await sequelize.query(query, {
    type: QueryTypes.INSERT,
  });
}

async function deleteTempCQDirectoryTable(): Promise<void> {
  const query = `DROP TABLE IF EXISTS ${cqDirectoryEntryTemp}`;
  await sequelize.query(query, {
    type: QueryTypes.DELETE,
  });
}

async function renameCQDirectoryTablesAndUpdateIndexes(): Promise<void> {
  await executeOnDBTx(CQDirectoryEntryViewModel.prototype, async transaction => {
    const dropBackupQuery = `DROP TABLE IF EXISTS ${cqDirectoryEntryBackup};`;
    await sequelize.query(dropBackupQuery, {
      type: QueryTypes.DELETE,
      transaction,
    });

    const lockTablesQuery = `LOCK TABLE ${cqDirectoryEntry} IN ACCESS EXCLUSIVE MODE;`;
    await sequelize.query(lockTablesQuery, {
      type: QueryTypes.RAW,
      transaction,
    });

    const renameTablesQuery = `
      ALTER TABLE ${cqDirectoryEntry} RENAME TO ${cqDirectoryEntryBackup};
      ALTER TABLE ${cqDirectoryEntryTemp} RENAME TO ${cqDirectoryEntry};
    `;
    await sequelize.query(renameTablesQuery, {
      type: QueryTypes.UPDATE,
      transaction,
    });

    await addUpdatedAtTrigger(sequelize.getQueryInterface(), transaction, cqDirectoryEntry);
  });
}
