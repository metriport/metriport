import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { QueryTypes, Sequelize } from "sequelize";
import { createMockCQOrganization } from "../../../external/carequality/organization-mock";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import { bulkInsertCQDirectoryEntries } from "./create-cq-directory-entry";
import { parseCQDirectoryEntries } from "./parse-cq-directory-entry";
import { sleep } from "@metriport/core/util/sleep";

const BATCH_SIZE = 1000;
const cqDirectoryEntryTemp = `cq_directory_entry_temp`;
const cqDirectoryEntry = `cq_directory_entry`;
const cqDirectoryEntryBackup = `cq_directory_entry_backup`;

const sqlDBCreds = Config.getDBCreds();
const dbCreds = JSON.parse(sqlDBCreds);

const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
});

export const rebuildCQDirectory = async (
  mockNumber: number | undefined,
  failGracefully = false
): Promise<void> => {
  let currentPosition = 0;
  let isDone = false;

  try {
    await createTempCQDirectoryTable();
    while (!isDone) {
      try {
        console.time("generation");
        let orgs = [];
        if (mockNumber) {
          if (currentPosition >= mockNumber) {
            isDone = true;
            break;
          }
          for (let j = 0; j < BATCH_SIZE; j++) {
            const fakeOrg = createMockCQOrganization();
            orgs.push(JSON.parse(fakeOrg));
          }
        } else {
          const apiKey = Config.getCQApiKey();
          const cq = new Carequality(apiKey);
          orgs = await cq.listOrganizations({ start: currentPosition });
          if (orgs.length < BATCH_SIZE) {
            isDone = true;
          }
        }
        currentPosition += BATCH_SIZE;
        const parsedOrgs = parseCQDirectoryEntries(orgs);
        console.timeEnd("generation");
        console.time("bulkInsert");
        await bulkInsertCQDirectoryEntries(sequelize, parsedOrgs);
        console.timeEnd("bulkInsert");
        console.log(`Added ${currentPosition} CQ directory entries...`);
        await sleep(750);
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
  } catch (error) {
    const msg = `Failed the last step of CQ directory rebuild`;
    console.log(`${msg}. Cause: ${error}`);
    capture.message(msg, {
      extra: { context: `renameCQDirectoryTablesAndUpdateIndexes`, error },
      level: "error",
    });
    throw error;
  }
};

const createTempCQDirectoryTable = async () => {
  const query = `CREATE TABLE IF NOT EXISTS ${cqDirectoryEntryTemp} AS SELECT * FROM ${cqDirectoryEntry} WHERE 1=0;`;
  await sequelize.query(query, {
    type: QueryTypes.INSERT,
  });
};

const deleteTempCQDirectoryTable = async () => {
  const query = `DROP TABLE IF EXISTS ${cqDirectoryEntryTemp}`;
  await sequelize.query(query, {
    type: QueryTypes.DELETE,
  });
};

const renameCQDirectoryTablesAndUpdateIndexes = async () => {
  const dropBackupQuery = `DROP TABLE IF EXISTS ${cqDirectoryEntryBackup};`;
  await sequelize.query(dropBackupQuery, {
    type: QueryTypes.DELETE,
    logging: false,
  });

  const renameTablesQuery = `
    ALTER TABLE ${cqDirectoryEntry} RENAME TO ${cqDirectoryEntryBackup};
    ALTER TABLE ${cqDirectoryEntryTemp} RENAME TO ${cqDirectoryEntry};
    ALTER INDEX IF EXISTS cq_directory_entry_pkey RENAME TO cq_directory_entry_backup_pkey;`;
  await sequelize.query(renameTablesQuery, {
    type: QueryTypes.UPDATE,
    logging: false,
  });

  const createIndexQuery = `CREATE INDEX IF NOT EXISTS cq_directory_entry_pkey ON ${cqDirectoryEntry} (id);`;
  await sequelize.query(createIndexQuery, {
    type: QueryTypes.INSERT,
    logging: false,
  });
};
