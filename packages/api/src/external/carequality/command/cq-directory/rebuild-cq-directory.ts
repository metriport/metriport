import { errorToString } from "@metriport/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { initDbPool } from "@metriport/core/util/sequelize";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { addUpdatedAtTrigger } from "../../../../sequelize/migrations-shared";
import { Config } from "../../../../shared/config";
import { makeCarequalityManagementAPIFhir } from "../../api";
import { CQDirectoryEntryModel } from "../../models/cq-directory";
import { parseFhirOrganization } from "../../shared";
import { bulkInsertCQDirectoryEntries } from "./create-cq-directory-entry";
import { parseCQDirectoryEntryFromCqOrgDetailsWithUrls } from "./parse-cq-directory-entry";

dayjs.extend(duration);
const BATCH_SIZE = 1000;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

const dbCreds = Config.getDBCreds();
const sequelize = initDbPool(dbCreds, {
  max: 10,
  min: 1,
  acquire: 30000,
  idle: 10000,
});

export const cqDirectoryEntryTemp = `cq_directory_entry_temp`;
export const cqDirectoryEntry = `cq_directory_entry`;
export const cqDirectoryEntryBackup = `cq_directory_entry_backup`;

export async function rebuildCQDirectory(failGracefully = false): Promise<void> {
  const { log } = out("rebuildCQDirectory - failGracefully: " + failGracefully);
  const cq = makeCarequalityManagementAPIFhir();
  if (!cq) throw new Error("Carequality API not initialized");

  let currentPosition = 0;
  let isDone = false;
  try {
    await createTempCQDirectoryTable();
    while (!isDone) {
      try {
        const orgs = await cq.listOrganizations({ start: currentPosition, count: BATCH_SIZE });
        if (orgs.length < BATCH_SIZE) isDone = true;
        currentPosition += BATCH_SIZE;
        const parsedOrgs = orgs
          .map(parseFhirOrganization)
          .map(parseCQDirectoryEntryFromCqOrgDetailsWithUrls);
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
      extra: {
        context: `rebuildCQDirectory`,
        error,
      },
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
      extra: {
        context: `renameCQDirectoryTablesAndUpdateIndexes`,
        error,
      },
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
  await executeOnDBTx(CQDirectoryEntryModel.prototype, async transaction => {
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
