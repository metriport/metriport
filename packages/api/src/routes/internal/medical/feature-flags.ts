import {
  featureFlagsRecordUpdateSchema,
  getFeatureFlagsRecord,
  updateFeatureFlagsRecord,
} from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Config } from "@metriport/core/util/config";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /internal/feature-flags
 *
 * Get the feature flags from the database.
 *
 * @return 200 The feature flags record.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const ffRecord = await getFeatureFlagsRecord({
      region: Config.getAWSRegion(),
      tableName: Config.getFeatureFlagsTableName(),
    });
    return res.status(httpStatus.OK).json(ffRecord);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/feature-flags
 *
 * Update the feature flags in the database.
 *
 * Requires a version number to be provided, so that we can ensure we're
 * updating based on the latest version.
 *
 * @param req.body The new feature flags record.
 *        req.body.featureFlags: The feature flags to update.
 *        req.body.version: The current version of the feature flags.
 * @return 200 the updated feature flags record.
 *         400 if the update was not successful (usually due to a version mismatch).
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const newRecordData = featureFlagsRecordUpdateSchema.parse(req.body);
    const ffRecord = await updateFeatureFlagsRecord({
      region: Config.getAWSRegion(),
      tableName: Config.getFeatureFlagsTableName(),
      newRecordData,
    });
    return res.status(httpStatus.OK).json(ffRecord);
  })
);

export default router;
