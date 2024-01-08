import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { sleep } from "@metriport/core/util/sleep";
import { QueryTypes, Sequelize } from "sequelize";
import { Config } from "../../../../shared/config";
import { capture } from "@metriport/core/util/capture";
import { bulkInsertCQDirectoryEntries } from "./create-cq-directory-entry";
import { parseCQDirectoryEntries } from "./parse-cq-directory-entry";
import { cqDirectoryEntryTemp, cqDirectoryEntry, cqDirectoryEntryBackup } from "./shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

dayjs.extend(duration);
const BATCH_SIZE = 1000;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

const sqlDBCreds = Config.getDBCreds();
const dbCreds = JSON.parse(sqlDBCreds);

const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
});

export async function rebuildCQDirectory(failGracefully = false): Promise<void> {
  let currentPosition = 0;
  let isDone = false;

  try {
    await createTempCQDirectoryTable();
    while (!isDone) {
      try {
        const apiKey = Config.getCQApiKey();
        const cq = new Carequality(apiKey); // TODO: use the prod API mode - https://github.com/metriport/metriport-internal/issues/1350
        const orgs = await cq.listOrganizations({ start: currentPosition, count: BATCH_SIZE });
        if (orgs.length < BATCH_SIZE) isDone = true; // if CQ directory returns less than BATCH_SIZE number of orgs, that means we've hit the end
        currentPosition += BATCH_SIZE;
        const parsedOrgs = parseCQDirectoryEntries(orgs);
        console.log(
          `Adding ${parsedOrgs.length} CQ directory entries... Total fetched: ${currentPosition}`
        );
        await bulkInsertCQDirectoryEntries(sequelize, parsedOrgs);
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
    console.log(`${msg}, error: ${error}`);
    capture.message(msg, {
      extra: { context: `rebuildCQDirectory`, error },
      level: "error",
    });
    throw error;
  }
  try {
    await renameCQDirectoryTablesAndUpdateIndexes();
    console.log("CQ directory successfully rebuilt! :)");
  } catch (error) {
    const msg = `Failed the last step of CQ directory rebuild`;
    await deleteTempCQDirectoryTable();
    console.log(`${msg}. Cause: ${error}`);
    capture.message(msg, {
      extra: { context: `renameCQDirectoryTablesAndUpdateIndexes`, error },
      level: "error",
    });
    throw error;
  }
}

async function createTempCQDirectoryTable(): Promise<void> {
  const query = `CREATE TABLE IF NOT EXISTS ${cqDirectoryEntryTemp} AS SELECT * FROM ${cqDirectoryEntry} WHERE 1=0;`;
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
      logging: false,
      transaction,
    });

    const lockTablesQuery = `LOCK TABLE ${cqDirectoryEntry} IN ACCESS EXCLUSIVE MODE;`;
    await sequelize.query(lockTablesQuery, {
      type: QueryTypes.RAW,
      logging: false,
      transaction,
    });

    const renameTablesQuery = `
    ALTER TABLE ${cqDirectoryEntry} RENAME TO ${cqDirectoryEntryBackup};
    ALTER TABLE ${cqDirectoryEntryTemp} RENAME TO ${cqDirectoryEntry};
    ALTER INDEX IF EXISTS cq_directory_entry_pkey RENAME TO cq_directory_entry_backup_pkey;`;
    await sequelize.query(renameTablesQuery, {
      type: QueryTypes.UPDATE,
      logging: false,
      transaction,
    });

    const createIndexQuery = `CREATE INDEX IF NOT EXISTS cq_directory_entry_pkey ON ${cqDirectoryEntry} (id);`;
    await sequelize.query(createIndexQuery, {
      type: QueryTypes.INSERT,
      logging: false,
      transaction,
    });
  });
}
