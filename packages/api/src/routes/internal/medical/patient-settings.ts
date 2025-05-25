import { upsertPatientSettingsSchema } from "@metriport/api-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  upsertPatientSettingsByFacility,
  upsertPatientSettingsByPatient,
  upsertPatientSettingsForCx,
} from "../../../command/medical/patient/settings/create-patient-settings";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";
import { MetriportError } from "../../../../../shared/dist";

dayjs.extend(duration);

const router = Router();

const defaultSettings = {};

/** ---------------------------------------------------------------------------
 * POST /internal/patient/settings/
 *
 * Creates or updates patient settings for a select set of patients.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.type The type of operation to perform. Either "patientList" or "facility".
 * @param req.query.facilityId The facility ID. Either this or patientIds must be provided.
 * @param req.query.patientIds List of patient IDs to update. Either this or facilityId must be provided.
 * @param req.body The patient settings to apply. Optional, defaults to empty object.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, settings, ...rest } =
      upsertPatientSettingsSchema.parse(req.body) ?? defaultSettings;

    let result;
    if (rest.type === "patientList") {
      result = await upsertPatientSettingsByPatient({
        cxId,
        settings,
        patientIds: rest.patientIds,
      });
    } else if (rest.type === "facility") {
      result = await upsertPatientSettingsByFacility({
        cxId,
        settings,
        facilityId: rest.facilityId,
      });
    } else {
      throw new MetriportError("Invalid operation type", undefined, {
        status: status.BAD_REQUEST,
      });
    }

    return res.status(status.OK).json(result);
  })
);

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
    const { cxId, settings } = upsertPatientSettingsSchema.parse(req.body) ?? defaultSettings;

    const result = await upsertPatientSettingsForCx({
      cxId,
      settings,
    });

    return res.status(status.OK).json(result);
  })
);

export default router;
