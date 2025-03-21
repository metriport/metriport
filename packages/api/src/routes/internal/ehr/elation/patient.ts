import { processAsyncError } from "@metriport/core/util/error/shared";
import { BadRequestError } from "@metriport/shared";
import { isSubscriptionResource } from "@metriport/shared/interface/external/ehr/elation/subscription";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/elation/command/process-patients-from-appointments";
import { syncElationPatientIntoMetriport } from "../../../../external/ehr/elation/command/sync-patient";
import { getElationSigningKeyInfo } from "../../../../external/ehr/elation/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

/**
 * POST /internal/ehr/elation/patient/from-appointments
 *
 * Fetches appointments in the time range and creates all patients not already existing
 */
router.post(
  "/from-appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments().catch(
      processAsyncError("Elation processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/elation/patient/appointments
 *
 * Fetches appointments in the future and creates all patients not already existing
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments().catch(
      processAsyncError("Elation processPatientsFromAppointments")
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/elation/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.params.id The ID of Elation Patient.
 * @returns Metriport Patient if found.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const elationPatientId = getFromQueryOrFail("patientId", req);
    const elationPracticeId = getFromQueryOrFail("practiceId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    syncElationPatientIntoMetriport({
      cxId,
      elationPracticeId,
      elationPatientId,
      triggerDq,
    }).catch(processAsyncError("Elation syncElationPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehr/elation/signing-key
 *
 * Tries to retrieve the signing key for the given applicationId and resource
 * @param req.query.applicationId The ID of the Elation application.
 * @param req.query.resource The subscription resource type.
 * @returns The signing key.
 */
router.get(
  "/signing-key",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = getFromQueryOrFail("applicationId", req);
    const resource = getFromQueryOrFail("resource", req);
    if (!isSubscriptionResource(resource)) {
      throw new BadRequestError("Invalid resource", undefined, { resource });
    }
    const signingKey = await getElationSigningKeyInfo(applicationId, resource);
    return res.status(httpStatus.OK).json({ signingKey });
  })
);

export default router;
