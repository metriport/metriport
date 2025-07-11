import { upsertPatientSettingsSchema } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { upsertPatientSettingsByPatientIds } from "../../../command/medical/patient/settings/create-patient-settings";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

dayjs.extend(duration);

const router = Router();

const defaultSettings = {};

/** ---------------------------------------------------------------------------
 * POST /internal/patient/settings/bulk
 *
 * Creates or updates patient settings across all patients for a CX.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body The patient settings to apply. Optional, defaults to empty object.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/bulk",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, settings, patientIds } =
      upsertPatientSettingsSchema.parse(req.body) ?? defaultSettings;

    const result = await upsertPatientSettingsByPatientIds({
      cxId,
      settings,
      patientIds,
    });

    return res.status(status.OK).json(result);
  })
);

export default router;
