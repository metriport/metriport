import { getCxsWithSurescriptsFeatureFlag } from "@metriport/core/command/feature-flags/domain-ffs";
import { buildIngestAllResponsesHandler } from "@metriport/core/external/surescripts/command/ingest-all-responses/ingest-all-responses-factory";
import { buildSurescriptsUploadRosterHandler } from "@metriport/core/external/surescripts/command/upload-roster/upload-roster-factory";
import { BadRequestError } from "@metriport/shared";
import {
  isValidSurescriptsRosterType,
  SurescriptsRosterType,
} from "@metriport/shared/interface/external/surescripts/roster";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFromParamsOrFail, getFromQueryAsBoolean } from "../../util";

dayjs.extend(duration);
const router = Router();

/**
 * Validates the roster type from the request parameters, and throws a BadRequestError if it is invalid.
 */
function getRosterTypeFromParamsOrFail(req: Request): SurescriptsRosterType {
  const rosterTypeParam = getFromParamsOrFail("rosterType", req);
  if (!isValidSurescriptsRosterType(rosterTypeParam)) {
    throw new BadRequestError("Invalid roster type", undefined, {
      rosterType: rosterTypeParam,
    });
  }
  return rosterTypeParam;
}

/** ---------------------------------------------------------------------------
 * POST /internal/surescripts/upload-roster
 *
 * Uploads the latest patient roster to Surescripts. This route is triggered by a scheduled Lambda
 * function, and can also be manually triggered by an internal user to upload the latest roster. It *always*
 * triggers the SurescriptsUploadRoster handler, since any roster uploads to Surescripts must originate from a whitelisted
 * VPC IP address.
 *
 * @see packages/infra/lib/surescripts/surescripts-stack.ts
 * @returns 200 OK
 */
router.post(
  "/upload-roster/:rosterType",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const rosterType = getRosterTypeFromParamsOrFail(req);
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const rosterId = getUUIDFrom("query", req, "rosterId").optional();
    const includeMultipleDemographics = getFromQueryAsBoolean("includeMultipleDemographics", req);
    const includeAugmentationDemographics = getFromQueryAsBoolean(
      "includeAugmentationDemographics",
      req
    );
    if ((cxId && !rosterId) || (!cxId && rosterId)) {
      throw new BadRequestError("Both cxId and rosterId must be provided together");
    }

    const cxIds = cxId ? [cxId] : await getCxsWithSurescriptsFeatureFlag();
    for (const cxId of cxIds) {
      const handler = buildSurescriptsUploadRosterHandler();
      await handler.uploadRoster({
        cxId,
        rosterType,
        ...(rosterId ? { rosterId } : {}),
        ...(includeMultipleDemographics ? { includeMultipleDemographics } : {}),
        ...(includeAugmentationDemographics ? { includeAugmentationDemographics } : {}),
      });
    }
    return res.sendStatus(status.OK);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/surescripts/ingest-all-responses
 *
 * Ingest all new Surescripts responses from the Surescripts SFTP server and uploads them to the Surescripts replica.
 * This triggers the next steps of the data pipeline, which convert the ingested responses to FHIR bundles.
 *
 * @returns 200 OK
 */
router.post(
  "/ingest-all-responses",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const handler = buildIngestAllResponsesHandler();
    await handler.ingestAllResponses();
    return res.sendStatus(status.OK);
  })
);

export default router;
