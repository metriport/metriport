import { out } from "@metriport/core/util/log";
import { makeEhexManagementApiOrFail } from "../../api";
import { Config } from "../../../../shared/config";
import { initDbPool } from "@metriport/core/util/sequelize";
import {
  createTempEhexDirectoryTable,
  deleteEhexDirectoryEntries,
  deleteTempEhexDirectoryTable,
  getEhexDirectoryIds,
  insertEhexDirectoryEntries,
  updateEhexDirectoryViewDefinition,
} from "./rebuild-ehex-directory-raw-sql";
import dayjs, { duration } from "dayjs";
import { CachedEhexOrgLoader } from "../organization/get-ehex-organization-cached";
import { EhexDirectoryEntryData } from "../../ehex-directory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { Organization } from "@medplum/fhirtypes";
import { parseEhexOrganization } from "../organization/parse-ehex-organization";
import { sleep } from "@metriport/shared/common/sleep";
import { errorToString } from "@metriport/shared/common/error";
import { capture } from "@metriport/core/util";
import { Sequelize } from "sequelize";
import { getAdditionalOrgs } from "./additional-orgs";

dayjs.extend(duration);

const BATCH_SIZE = 1_000; // This is the maximum supported by the Ehex Directory API
const parallelQueriesToGetManagingOrg = 20;
const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

export async function rebuildEhexDirectory({
  failGracefully = false,
}: { failGracefully?: boolean } = {}): Promise<void> {
  const context = "rebuildEhexDirectory";
  const { log } = out(context);
  const dbCreds = Config.getDBCreds();
  const sequelize = initDbPool(dbCreds, {
    max: 10,
    min: 1,
    acquire: 30000,
    idle: 10000,
  });

  let currentPosition = 0;
  let isDone = false;
  let nextUrl: string | undefined;
  const startedAt = Date.now();
  const ehex = await makeEhexManagementApiOrFail();
  let parsedOrgsCount = 0;
  const parsingErrors: Error[] = [];
  const principalAndDelegatesMap = new Map<string, string[]>();
  try {
    await createTempEhexDirectoryTable(sequelize);
    const cache = new CachedEhexOrgLoader(ehex);
    while (!isDone) {
      try {
        const maxPosition = currentPosition + BATCH_SIZE;
        log(`Loading active Ehex directory entries, from ${currentPosition} up to ${maxPosition}`);
        const loadStartedAt = Date.now();
        const response = await ehex.listOrganizations({
          count: BATCH_SIZE,
          active: true,
          sortKey: "_id",
          url: nextUrl,
          isHubAware: true,
        });
        const orgs = response.organizations;
        log(`Loaded ${orgs.length} entries in ${Date.now() - loadStartedAt}ms`);
        nextUrl = response.link.next;
        if (!nextUrl) isDone = true;
        cache.populate(orgs);
        const parsedOrgs: EhexDirectoryEntryData[] = [];
        const [alreadyInsertedIds] = await Promise.all([
          getEhexDirectoryIds(sequelize),
          executeAsynchronously(
            orgs,
            async (org: Organization) => {
              try {
                const parsed = await parseEhexOrganization(org, cache);
                parsedOrgs.push(parsed);
                if (parsed.delegateOids && parsed.delegateOids.length > 0) {
                  principalAndDelegatesMap.set(parsed.id, parsed.delegateOids);
                }
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
        await insertEhexDirectoryEntries(sequelize, orgsToInsert);
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
    await processAdditionalOrgs(sequelize);

    if (parsingErrors.length > 0) {
      const msg = `Parsing errors while rebuilding the Ehex directory`;
      const errors = parsingErrors.map(error => errorToString(error)).join("; ");
      log(`${msg}: ${errors}`);
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
    await deleteTempEhexDirectoryTable(sequelize);
    const msg = `Failed to rebuild the directory`;
    log(`${msg}, Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context, error: errorToString(error) },
    });
    await sequelize.close();
    throw error;
  }
  try {
    await updateEhexDirectoryViewDefinition(sequelize);
  } catch (error) {
    const msg = `Failed the last step of Ehex directory rebuild`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context: `updateEhexDirectoryViewDefinition`, error: errorToString(error) },
    });
    throw error;
  } finally {
    await sequelize.close();
  }

  log(`Ehex directory successfully rebuilt! :) Took ${Date.now() - startedAt}ms`);
}

/**
 * Ehex directory entries on stage/dev are built for test purposes by other companies/implementors,
 * and very likely won't have any patient that matches our test's demographics, so we might
 * as well keep them inactive to minimize cost/scale issues on pre-prod envs.
 */
function normalizeExternalOrgs(parsedOrgs: EhexDirectoryEntryData[]): EhexDirectoryEntryData[] {
  if (Config.isStaging() || Config.isDev()) {
    return parsedOrgs.map(org => ({
      ...org,
      active: false,
    }));
  }
  return parsedOrgs;
}

/**
 * Process/include additional orgs that are not in the Ehex directory.
 * Used for staging/dev envs.
 *
 * // TODO: 1582 - Check if the operations within this function are still needed.
 */
async function processAdditionalOrgs(sequelize: Sequelize): Promise<void> {
  const context = "processAdditionalOrgs";
  const { log } = out(context);
  try {
    const additionalOrgs = getAdditionalOrgs();
    if (additionalOrgs.length < 1) return;
    const additionalOrgIds = additionalOrgs.map(o => o.id);

    log(`Removing external Ehex entries for ${additionalOrgs.length} additional Orgs...`);
    await deleteEhexDirectoryEntries(sequelize, additionalOrgIds);

    log(`Inserting static Ehex entries for ${additionalOrgs.length} additional Orgs...`);
    await insertEhexDirectoryEntries(sequelize, additionalOrgs);
  } catch (error) {
    const msg = `Failed to process additional orgs`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { context, error: errorToString(error) },
    });
  }
}
