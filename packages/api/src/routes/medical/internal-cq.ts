import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createOrUpdateCQDirectoryEntry } from "../../command/medical/cq-directory/create-cq-directory-entry";
import { parseCQDirectoryEntries } from "../../command/medical/cq-directory/parse-cq-directory-entry";
import { Config } from "../../shared/config";
import { asyncHandler } from "../util";

const apiKey = Config.getCQApiKey();

dayjs.extend(duration);

const router = Router();

/**
 * POST /internal/carequality/rebuild-directory
 *
 * Retrieves organizations from the Carequality Directory and uploads them into our database.
 * @returns Returns the number of organizations fetched, how many are newly-added and how many updated.
 */
router.post(
  "/rebuild-directory",
  asyncHandler(async (req: Request, res: Response) => {
    const cq = new Carequality(apiKey);
    const resp = await cq.listAllOrganizations();
    const orgs = parseCQDirectoryEntries(resp);

    const response = {
      totalFetched: resp.length,
      added: 0,
      updated: 0,
    };

    const directoryEntryPromises = executeAsynchronously(orgs, async org => {
      const dbResponse = await createOrUpdateCQDirectoryEntry(org);
      dbResponse.updated ? response.updated++ : response.added++;
    });
    await Promise.all([directoryEntryPromises]);

    return res.status(httpStatus.OK).json(response);
  })
);

export default router;
