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
import { asyncHandler, getFrom } from "../util";
import NotFoundError from "@metriport/core/util/error/not-found";
import { capture } from "../../shared/notifications";

const maxNumberOfParallelRequestsToDB = 20;
const apiKey = Config.getCQApiKey();
const cq = new Carequality(apiKey);

dayjs.extend(duration);

const router = Router();

/**
 * POST /internal/carequality/directory/rebuild
 *
 * Retrieves organizations from the Carequality Directory and uploads them into our database.
 * @returns Returns the number of organizations fetched, how many are newly-added and how many updated.
 */
router.post(
  "/directory/rebuild",
  asyncHandler(async (req: Request, res: Response) => {
    const resp = await cq.listAllOrganizations();
    const orgs = parseCQDirectoryEntries(resp);

    const response = {
      totalFetched: resp.length,
      added: 0,
      updated: 0,
    };

    await executeAsynchronously(
      orgs,
      async org => {
        const dbResponse = await createOrUpdateCQDirectoryEntry(org);
        dbResponse.updated ? response.updated++ : response.added++;
      },
      {
        numberOfParallelExecutions: maxNumberOfParallelRequestsToDB,
      }
    );

    return res.status(httpStatus.OK).json(response);
  })
);

/**
 * GET /internal/carequality/directory/:oid
 *
 * Retrieves the organization with the specified OID from the Carequality Directory.
 * @returns Returns the organization.
 */
router.get(
  "/directory/:oid",
  asyncHandler(async (req: Request, res: Response) => {
    const oid = getFrom("params").orFail("oid", req);
    const resp = await cq.listOrganizations({ count: 1, oid });
    const org = parseCQDirectoryEntries(resp);

    if (org.length > 1) {
      const msg = "More than one organization with the same OID found in the CQ directory";
      console.log(msg, oid);
      capture.message(msg, {
        extra: { context: `carequality.directory`, oid, organizations: org, level: "info" },
      });
    }

    const matchingOrg = org[0];
    if (!matchingOrg) throw new NotFoundError("Organization not found");

    return res.status(httpStatus.OK).json(matchingOrg);
  })
);

export default router;
