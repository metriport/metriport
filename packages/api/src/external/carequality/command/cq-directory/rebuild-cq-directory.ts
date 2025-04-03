import { Organization } from "@medplum/fhirtypes";
import { capture, executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { initDbPool } from "@metriport/core/util/sequelize";
import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../../shared/config";
import { makeCarequalityManagementApiOrFail } from "../../api";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CachedCqOrgLoader } from "../cq-organization/get-cq-organization-cached";
import { parseCQOrganization } from "../cq-organization/parse-cq-organization";
import { getAdditionalOrgs } from "./additional-orgs";
import {
  createTempCqDirectoryTable,
  deleteCqDirectoryEntries,
  deleteTempCqDirectoryTable,
  getCqDirectoryIds,
  insertCqDirectoryEntries,
  updateCqDirectoryViewDefinition,
} from "./rebuild-cq-directory-raw-sql";

dayjs.extend(duration);

const BATCH_SIZE = 5_000;
const parallelQueriesToGetManagingOrg = 20;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

const dbCreds = Config.getDBCreds();
const sequelize = initDbPool(dbCreds, {
  max: 10,
  min: 1,
  acquire: 30000,
  idle: 10000,
});

export async function rebuildCQDirectory(failGracefully = false): Promise<void> {
  const context = "rebuildCQDirectory";
  const { log } = out(context);
  let currentPosition = 0;
  let isDone = false;
  const startedAt = Date.now();
  const cq = makeCarequalityManagementApiOrFail();
  let parsedOrgsCount = 0;
  const parsingErrors: Error[] = [];
  try {
    await createTempCqDirectoryTable(sequelize);
    const cache = new CachedCqOrgLoader(cq);
    while (!isDone) {
      try {
        const maxPosition = currentPosition + BATCH_SIZE;
        log(`Loading active CQ directory entries, from ${currentPosition} up to ${maxPosition}`);
        const loadStartedAt = Date.now();
        const orgs = await cq.listOrganizations({
          start: currentPosition,
          count: BATCH_SIZE,
          active: true,
          sortKey: "_id",
        });
        log(`Loaded ${orgs.length} entries in ${Date.now() - loadStartedAt}ms`);
        if (orgs.length < BATCH_SIZE) isDone = true;
        cache.populate(orgs);
        const parsedOrgs: CQDirectoryEntryData[] = [];
        const [alreadyInsertedIds] = await Promise.all([
          getCqDirectoryIds(sequelize),
          executeAsynchronously(
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
          ),
        ]);
        parsedOrgsCount += parsedOrgs.length;
        log(`Successfully parsed ${parsedOrgs.length} entries`);
        const normalizedOrgs = normalizeExternalOrgs(parsedOrgs);
        const orgsToInsert = normalizedOrgs.filter(
          org => !alreadyInsertedIds.some(id => id === org.id)
        );
        log(`Adding ${orgsToInsert.length} entries in the DB...`);
        const insertStartedAt = Date.now();
        await insertCqDirectoryEntries(sequelize, orgsToInsert);
        log(`Inserted ${orgsToInsert.length} entries in ${Date.now() - insertStartedAt}ms`);
        if (!isDone) await sleep(SLEEP_TIME.asMilliseconds());
        currentPosition = maxPosition;
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
          context,
          amountParsed: parsedOrgsCount,
          amountError: parsingErrors.length,
          errors,
        },
      });
    }
  } catch (error) {
    await deleteTempCqDirectoryTable(sequelize);
    const msg = `Failed to rebuild the directory`;
    log(`${msg}, Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context, error },
    });
    throw error;
  }
  try {
    await updateCqDirectoryViewDefinition(sequelize);
    log(`CQ directory successfully rebuilt! :) Took ${Date.now() - startedAt}ms`);
  } catch (error) {
    const msg = `Failed the last step of CQ directory rebuild`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context: `updateCqDirectoryViewDefinition`, error },
    });
    throw error;
  }
}

/**
 * CQ directory entries on stage/dev are built for test purposes by other companies/implementors,
 * and very likely won't have any patient that matches our test's demographics, so we might
 * as well keep them inactive to minimize cost/scale issues on pre-prod envs.
 */
function normalizeExternalOrgs(parsedOrgs: CQDirectoryEntryData[]): CQDirectoryEntryData[] {
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
  const context = "processAdditionalOrgs";
  const { log } = out(context);
  try {
    const additionalOrgs = getAdditionalOrgs();
    if (additionalOrgs.length < 1) return;
    const additionalOrgIds = additionalOrgs.map(o => o.id);

    log(`Removing external CQ entries for ${additionalOrgs.length} additional Orgs...`);
    await deleteCqDirectoryEntries(sequelize, additionalOrgIds);

    log(`Inserting static CQ entries for ${additionalOrgs.length} additional Orgs...`);
    await insertCqDirectoryEntries(sequelize, additionalOrgs);
  } catch (error) {
    const msg = `Failed to process additional orgs`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context, error },
    });
  }
}
