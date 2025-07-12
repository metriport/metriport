import { patientSettingsSchema } from "@metriport/api-sdk";
import { throwOnInvalidHieName } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { adtSubscriptionRequestSchema, patientSettingsRequestSchema } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  addHieSubscriptionToPatients,
  removeHieSubscriptionFromPatients,
} from "../../../command/medical/patient/settings/hie-subscriptions";
import {
  upsertPatientSettingsForCx,
  upsertPatientSettingsForPatientList,
} from "../../../command/medical/patient/settings/create-patient-settings";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler } from "../../util";

dayjs.extend(duration);

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /internal/patient/settings/
 *
 * Creates or updates patient settings for a select list of patient IDs.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @param req.query.patientIds List of patient IDs to update.
 * @param req.body The patient settings to apply. Optional, defaults to empty object.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").optional();
    const { patientIds, settings } = patientSettingsRequestSchema.parse(req.body);

    settings.subscriptions?.adt?.forEach(throwOnInvalidHieName);

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
 * POST /internal/patient/settings/adt
 *
 * Adds an ADT subscription for a select list of patient IDs.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @param req.body The patient settings to apply. Optional, defaults to empty object.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/adt",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").optional();
    const { patientIds, hieName } = adtSubscriptionRequestSchema.parse(req.body);

    throwOnInvalidHieName(hieName);

    const result = await addHieSubscriptionToPatients({
      cxId,
      facilityId,
      patientIds,
      hieName,
    });

    return res.status(status.OK).json(result);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/patient/settings/adt
 *
 * Removes an ADT subscription for a select list of patient IDs.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @param req.body The patient settings to apply. Optional, defaults to empty object.
 * @returns 200 with the results of the operation.
 */
router.delete(
  "/adt",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").optional();
    const { patientIds, hieName } = adtSubscriptionRequestSchema.parse(req.body);

    throwOnInvalidHieName(hieName);

    const result = await removeHieSubscriptionFromPatients({
      cxId,
      facilityId,
      patientIds,
      hieName,
    });

    return res.status(status.OK).json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/patient/settings/bulk
 *
 * Creates or updates patient settings across all patients for a CX.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.facilityId The facility ID. Optional.
 * @param req.body The patient settings to apply. Optional, defaults to empty object.
 * @returns 200 with the results of the operation.
 */
router.post(
  "/bulk",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").optional();
    const settings = patientSettingsSchema.parse(req.body);

    settings.subscriptions?.adt?.forEach(throwOnInvalidHieName);

    const result = await upsertPatientSettingsForCx({
      cxId,
      facilityId,
      settings,
    });

    return res.status(status.OK).json(result);
  })
);

export default router;
