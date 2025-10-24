import { safelyUploadPrincipalAndDelegatesToS3 } from "@metriport/core/external/hie-shared/principal-and-delegates";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { initDbPool } from "@metriport/core/util/sequelize";
import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../../shared/config";
import { makeCommonWellMemberAPI } from "../../../commonwell-v2/api";
import { CwDirectoryEntryData } from "../../cw-directory";
import { parseCWOrganization } from "./parse-cw-organization";
import {
  createTempCwDirectoryTable,
  deleteTempCwDirectoryTable,
  getCwDirectoryIds,
  insertCwDirectoryEntries,
  updateCwDirectoryViewDefinition,
} from "./rebuild-cw-directory-raw-sql";

dayjs.extend(duration);

// CW Directory API is limited to 100 organizations per request
const BATCH_SIZE = 100;

const SLEEP_TIME = dayjs.duration({ milliseconds: 750 });

export async function rebuildCwDirectory(failGracefully = false): Promise<void> {
  const context = "rebuildCwDirectory";
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
  const startedAt = Date.now();
  const cw = makeCommonWellMemberAPI();
  let parsedOrgsCount = 0;
  const parsingErrors: Error[] = [];
  const principalAndDelegatesMap = new Map<string, string[]>();

  try {
    await createTempCwDirectoryTable(sequelize);

    while (!isDone) {
      try {
        const maxPosition = currentPosition + BATCH_SIZE;
        log(`Loading active CW directory entries, from ${currentPosition} up to ${maxPosition}`);
        const loadStartedAt = Date.now();

        const [response, alreadyInsertedIds] = await Promise.all([
          cw.listOrganizations({
            offset: currentPosition,
            limit: BATCH_SIZE,
            sort: "organizationId",
          }),
          getCwDirectoryIds(sequelize),
        ]);

        log(`Loaded ${response.organizations.length} entries in ${Date.now() - loadStartedAt}ms`);
        if (response.organizations.length < BATCH_SIZE) isDone = true;

        const parsedOrgs: CwDirectoryEntryData[] = [];
        for (const org of response.organizations) {
          try {
            const parsed = parseCWOrganization(org);
            if (parsed.active) parsedOrgs.push(parsed); // we don't want to store inactive organizations
          } catch (error) {
            parsingErrors.push(error as Error);
          }
        }

        parsedOrgsCount += parsedOrgs.length;
        log(`Successfully parsed ${parsedOrgs.length} entries`);

        const orgsToInsert = parsedOrgs.filter(
          org => !alreadyInsertedIds.some(id => id === org.id)
        );
        orgsToInsert.forEach(org => {
          if (org.delegateOids && org.delegateOids.length > 0) {
            principalAndDelegatesMap.set(org.id, org.delegateOids);
          }
        });

        log(`Adding ${orgsToInsert.length} entries in the DB...`);
        const insertStartedAt = Date.now();
        await insertCwDirectoryEntries(sequelize, orgsToInsert);
        log(`Inserted ${orgsToInsert.length} entries in ${Date.now() - insertStartedAt}ms`);

        if (!isDone) await sleep(SLEEP_TIME.asMilliseconds());
        currentPosition = maxPosition;
      } catch (error) {
        isDone = true;
        const batchErrorMsg = `Error rebuilding CW directory`;
        log(
          `${batchErrorMsg}: batch at position ${currentPosition}. Cause: ${errorToString(error)}`
        );
        if (!failGracefully) {
          throw error;
        }
      }
    }

    if (parsingErrors.length > 0) {
      const msg = `Parsing errors while rebuilding the CW directory`;
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
    try {
      await deleteTempCwDirectoryTable(sequelize);
      const msg = `Failed to rebuild the directory`;
      const errorContext = errorToString(error);
      log(`${msg}, Cause: ${errorContext}`);
      capture.error(msg, {
        extra: { context, error: errorContext },
      });
      throw error;
    } finally {
      await sequelize.close();
    }
  }

  try {
    await Promise.all([
      safelyUploadPrincipalAndDelegatesToS3(principalAndDelegatesMap, "cw"),
      updateCwDirectoryViewDefinition(sequelize),
    ]);
  } catch (error) {
    const msg = `Failed the last step of CW directory rebuild`;
    const errorContext = errorToString(error);
    log(`${msg}. Cause: ${errorContext}`);
    capture.error(msg, {
      extra: { context: `updateCwDirectoryViewDefinition`, error: errorContext },
    });
    throw error;
  } finally {
    await sequelize.close();
  }

  log(`CW directory successfully rebuilt! :) Took ${Date.now() - startedAt}ms`);
}
