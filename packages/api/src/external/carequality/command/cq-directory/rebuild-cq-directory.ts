import { Organization } from "@medplum/fhirtypes";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { initDbPool } from "@metriport/core/util/sequelize";
import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { Config } from "../../../../shared/config";
import { makeCarequalityManagementAPIOrFail } from "../../api";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";
import { CachedCqOrgLoader } from "../cq-organization/get-cq-organization-cached";
import { parseCQOrganization } from "../cq-organization/parse-cq-organization";
import { bulkInsertCQDirectoryEntries } from "./create-cq-directory-entry";

dayjs.extend(duration);

const BATCH_SIZE = 5_000;
const parallelQueriesToGetManagingOrg = 20;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

// TODO 2553 To be updated to `cq_directory_entry` on a follow-up PR
const cqDirectoryEntry = `cq_directory_entry_new`;
const cqDirectoryEntryTemp = `cq_directory_entry_temp`;
const cqDirectoryEntryBackup1 = `cq_directory_entry_backup1`;
const cqDirectoryEntryBackup2 = `cq_directory_entry_backup2`;
const cqDirectoryEntryBackup3 = `cq_directory_entry_backup3`;
const cqDirectoryEntryView = `cq_directory_entry_view`;

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
  const startedAt = Date.now();
  const cq = makeCarequalityManagementAPIOrFail();

  try {
    await createTempCQDirectoryTable();
    const cache = new CachedCqOrgLoader(cq);
    while (!isDone) {
      try {
        const maxPosition = currentPosition + BATCH_SIZE;
        log(`Loading active CQ directory entries, from ${currentPosition} up to ${maxPosition}`);
        const orgs = await cq.listOrganizations({
          start: currentPosition,
          count: BATCH_SIZE,
          active: true,
        });
        // If CQ directory returns less than BATCH_SIZE number of orgs, that means we've hit the end
        if (orgs.length < BATCH_SIZE) isDone = true;
        currentPosition = maxPosition;
        await cache.populate(orgs);
        const parsedOrgs: CQDirectoryEntryData2[] = [];
        await executeAsynchronously(
          orgs,
          async (org: Organization) => {
            const parsed = await parseCQOrganization(org, cache);
            if (parsed) parsedOrgs.push(parsed);
          },
          { numberOfParallelExecutions: parallelQueriesToGetManagingOrg }
        );
        log(`Adding ${parsedOrgs.length} CQ directory entries...`);
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
    await updateViewDefinition();
    log(`CQ directory successfully rebuilt! :) Took ${Date.now() - startedAt}ms`);
  } catch (error) {
    const msg = `Failed the last step of CQ directory rebuild`;
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
  await sequelize.query(query, { type: QueryTypes.RAW });
}

async function deleteTempCQDirectoryTable(): Promise<void> {
  const query = `DROP TABLE IF EXISTS ${cqDirectoryEntryTemp}`;
  await sequelize.query(query, { type: QueryTypes.RAW });
}

async function updateViewDefinition(): Promise<void> {
  await executeOnDBTx(CQDirectoryEntryViewModel.prototype, async transaction => {
    const dropView = `DROP VIEW IF EXISTS ${cqDirectoryEntryView};`;
    const createView = `CREATE VIEW ${cqDirectoryEntryView} AS SELECT * FROM ${cqDirectoryEntryTemp};`;
    const dropBackup3 = `DROP TABLE IF EXISTS ${cqDirectoryEntryBackup3};`;
    const renameBackup2To3 = `ALTER TABLE IF EXISTS ${cqDirectoryEntryBackup2} RENAME TO ${cqDirectoryEntryBackup3};`;
    const renameBackup1To2 = `ALTER TABLE IF EXISTS ${cqDirectoryEntryBackup1} RENAME TO ${cqDirectoryEntryBackup2};`;
    const renameNewToBackup = `ALTER TABLE ${cqDirectoryEntry} RENAME TO ${cqDirectoryEntryBackup1};`;
    const renameTempToNew = `ALTER TABLE ${cqDirectoryEntryTemp} RENAME TO ${cqDirectoryEntry};`;

    await sequelize.query(dropView, { type: QueryTypes.RAW, transaction });
    await sequelize.query(createView, { type: QueryTypes.RAW, transaction });
    await sequelize.query(dropBackup3, { type: QueryTypes.RAW, transaction });
    await sequelize.query(renameBackup2To3, { type: QueryTypes.RAW, transaction });
    await sequelize.query(renameBackup1To2, { type: QueryTypes.RAW, transaction });
    await sequelize.query(renameNewToBackup, { type: QueryTypes.RAW, transaction });
    await sequelize.query(renameTempToNew, { type: QueryTypes.RAW, transaction });
  });
}
