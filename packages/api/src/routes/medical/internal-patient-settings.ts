import { patientSettingsSchema } from "@metriport/api-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { getAdtSubscribers } from "../../command/medical/patient/get-adt-subscribers";
import {
  upsertPatientSettingsForCx,
  upsertPatientSettingsForPatientList,
} from "../../command/medical/patient/settings/create-patient-settings";
import { requestLogger } from "../helpers/request-logger";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFromQueryAsArrayOrFail } from "../util";

dayjs.extend(duration);

const router = Router();

const defaultSettings = {};

/** ---------------------------------------------------------------------------
 * POST /internal/patient-settings/
 *
 * Creates or updates patient settings for a select list of patient IDs.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @param req.query.patientIds List of patient IDs to update.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").optional();
    const patientIds = getFromQueryAsArrayOrFail("patientIds", req);
    const settings = patientSettingsSchema.parse(req.body) ?? defaultSettings;

    const result = await upsertPatientSettingsForPatientList({
      cxId,
      facilityId,
      patientIds,
      settings,
    });

    return res.status(status.OK).json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient-settings/bulk
 *
 * Creates or updates patient settings across all patients for a CX.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/bulk",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").optional();
    const settings = patientSettingsSchema.parse(req.body) ?? defaultSettings;

    const result = await upsertPatientSettingsForCx({
      cxId,
      facilityId,
      settings,
    });

    return res.status(status.OK).json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient-settings/adt-subscribers
 *
 * Gets all patients that have ADT subscriptions enabled for the given states.
 *
 * @param req.query.states List of US state codes to filter by
 * @returns List of patients with ADT subscriptions in the specified states
 */
router.post(
  "/adt-subscribers",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const states = getFromQueryAsArrayOrFail("states", req);
    const result = await getAdtSubscribers(states);

    return res.status(status.OK).json(result);
  })
);

export default router;
