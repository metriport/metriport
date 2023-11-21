import { Carequality } from "@metriport/carequality-sdk/client/carequality";
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
const apiMode = Config.getEnvType();

dayjs.extend(duration);

const router = Router();

/**
 * GET /internal/carequality
 *
 * Retrieves organizations from the Carequality Directory and uploads them into our database.
 * @returns Returns the number of organizations fetched, how many are newly-added and how many updated.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cq = new Carequality(apiKey, apiMode);
    const resp = await cq.listAllOrganizations();
    const orgs = parseCQDirectoryEntries(resp.organizations);

    const response = {
      totalFetched: resp.count,
      added: 0,
      updated: 0,
    };

    for (const org of orgs) {
      const dbResponse = await createOrUpdateCQDirectoryEntry(org);
      dbResponse.updated ? response.updated++ : response.added++;
    }

    return res.status(httpStatus.OK).json(response);
  })
);

export default router;
