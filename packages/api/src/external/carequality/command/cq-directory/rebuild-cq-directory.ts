import { Organization } from "@medplum/fhirtypes";
import { getEndpoints } from "@metriport/core/external/fhir/organization/endpoint";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { initDbPool } from "@metriport/core/util/sequelize";
import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import stringify from "json-stringify-safe";
import { partition } from "lodash";
import { QueryTypes } from "sequelize";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { Config } from "../../../../shared/config";
import { makeCarequalityManagementApiOrFail } from "../../api";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";
import { CachedCqOrgLoader } from "../cq-organization/get-cq-organization-cached";
import { parseCQOrganization } from "../cq-organization/parse-cq-organization";
import { getAdditionalOrgs } from "./additional-orgs";
import {
  bulkInsertCqDirectoryEntries,
  deleteCqDirectoryEntries,
  getCqDirectoryEntries,
  setCqDirectoryEntryActive,
} from "./rebuild-cq-directory-raw-sql";

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
  const cq = makeCarequalityManagementApiOrFail();
  let parsedOrgsCount = 0;
  const parsingErrors: Error[] = [];
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
        if (orgs.length < BATCH_SIZE) isDone = true;
        currentPosition = maxPosition;
        cache.populate(orgs);
        const parsedOrgs: CQDirectoryEntryData2[] = [];
        await executeAsynchronously(
          orgs,
          async (org: Organization) => {
            try {
              const parsed = await parseCQOrganization(org, cache);
              parsedOrgs.push(parsed);
            } catch (error) {
              parsingErrors.push(error as Error);
            }
          },
          { numberOfParallelExecutions: parallelQueriesToGetManagingOrg }
        );
        parsedOrgsCount += parsedOrgs.length;
        const orgsToInsert = normalizeExternalOrgs(parsedOrgs);
        log(`Adding ${orgsToInsert.length} CQ directory entries...`);
        await bulkInsertCqDirectoryEntries(sequelize, orgsToInsert, cqDirectoryEntryTemp);
        if (!isDone) await sleep(SLEEP_TIME.asMilliseconds());
      } catch (error) {
        isDone = true;
        if (!failGracefully) {
          throw error;
        }
      }
    }
    await processAdditionalOrgs();

    if (parsingErrors.length > 0) {
      const msg = `Parsing errors while rebuilding the CQ directory`;
      const errors = parsingErrors.map(error => errorToString(error)).join("; ");
      log(msg, errors);
      capture.message(msg, {
        extra: {
          context: `rebuildCQDirectory`,
          amountParsed: parsedOrgsCount,
          amountError: parsingErrors.length,
          errors,
        },
      });
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

/**
 * CQ directory entries on stage/dev are built for test purposes by other companies/implemetors,
 * and very likely won't have any patient that matches our test's demographics, so we might
 * as well keep them inactive to minimize cost/scale issues on pre-prod envs.
 */
function normalizeExternalOrgs(parsedOrgs: CQDirectoryEntryData2[]): CQDirectoryEntryData2[] {
  if (Config.isStaging() || Config.isDev()) {
    return parsedOrgs.map(org => ({
      ...org,
      active: false,
    }));
  }
  return parsedOrgs;
}

/**
 * Process/include additional orgs that are not in the CQ directory.
 * Used for staging/dev envs.
 */
async function processAdditionalOrgs(): Promise<void> {
  const { log } = out("processAdditionalOrgs");
  try {
    const additionalOrgs = getAdditionalOrgs();
    if (additionalOrgs.length < 1) return;

    const additionalOrgIds = additionalOrgs.map(o => o.id);
    const existingEntries = await getCqDirectoryEntries(
      sequelize,
      additionalOrgIds,
      cqDirectoryEntryTemp
    );

    const [orgsToUpdate, orgsToCreate] = partition(additionalOrgs, a =>
      existingEntries.some(e => e.id === a.id)
    );

    log(`Inserting/updating ${additionalOrgs.length} additional Orgs...`);
    await Promise.all([
      bulkInsertCqDirectoryEntries(sequelize, orgsToCreate, cqDirectoryEntryTemp),
      ...orgsToUpdate.map(org => updateCQDirectoryEntry(org, cqDirectoryEntryTemp)),
    ]);
  } catch (error) {
    const msg = `Failed to process additional orgs`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context: `processAdditionalOrgs`, error },
    });
  }
}

async function updateCQDirectoryEntry(
  additionalOrg: CQDirectoryEntryData2,
  tableName: string
): Promise<void> {
  const { log } = out("updateCQDirectoryEntry");

  const entries = await getCqDirectoryEntries(sequelize, [additionalOrg.id], tableName);
  if (!entries || entries.length < 1) return;
  if (entries.length > 1) {
    const msg = `Found multiple entries for additional org`;
    log(`${msg} ID ${additionalOrg.id}`);
    capture.error(msg, {
      extra: {
        context: `updateCQDirectoryEntry`,
        additionalOrgId: additionalOrg.id,
        entries: stringify(entries),
      },
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const entry = entries[0]!;
  const endpoints = entry.data ? getEndpoints(entry.data) : [];

  if (endpoints.length > 0) {
    log(
      `${additionalOrg.id} already has endpoints, setting active to true and skipping from config`
    );
    await setCqDirectoryEntryActive(sequelize, additionalOrg.id, tableName, true);
    return;
  }

  log(
    `${additionalOrg.id} does not have endpoints, removing existing and adding new one from config`
  );
  await deleteCqDirectoryEntries(sequelize, [additionalOrg.id], tableName);
  await bulkInsertCqDirectoryEntries(sequelize, [additionalOrg], tableName);
}
