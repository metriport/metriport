import { processAsyncError } from "@metriport/core/util/error/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processPatientsFromAppointments } from "../../../../external/ehr/athenahealth/command/process-patients-from-appointments";
import { syncAthenaPatientIntoMetriport } from "../../../../external/ehr/athenahealth/command/sync-patient";
import { updateAthenaPatientMappingDepartmentId } from "../../../../external/ehr/athenahealth/command/update-patient-mapping-department-id";
import { LookupModes } from "../../../../external/ehr/athenahealth/shared";
import { requestLogger } from "../../../helpers/request-logger";
import { getUUIDFrom } from "../../../schemas/uuid";
import { asyncHandler, getFromQueryAsBoolean, getFromQueryOrFail } from "../../../util";

const router = Router();

const athenaAsyncMsg = "AthenaHealth processPatientsFromAppointments";

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription
 *
 * Fetches appointment change events since last call and creates all patients not already existing
 * @returns 200 OK
 */
router.post(
  "/appointments-from-subscription",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.FromSubscription }).catch(
      processAsyncError(`${athenaAsyncMsg} ${LookupModes.FromSubscription}`)
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments-from-subscription-backfill
 *
 * Fetches appointment change events already processed and creates all patients not already existing
 * @returns 200 OK
 */
router.post(
  "/appointments-from-subscription-backfill",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.FromSubscriptionBackfill }).catch(
      processAsyncError(`${athenaAsyncMsg} ${LookupModes.FromSubscriptionBackfill}`)
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/appointments
 *
 * Fetches appointments in the future and creates all patients not already existing
 * @returns 200 OK
 */
router.post(
  "/appointments",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    processPatientsFromAppointments({ lookupMode: LookupModes.Appointments }).catch(
      processAsyncError(`${athenaAsyncMsg} ${LookupModes.Appointments}`)
    );
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient
 *
 * Tries to retrieve the matching Metriport patient
 * @param req.query.cxId The ID of Metriport Customer.
 * @param req.query.patientId The ID of AthenaHealth Patient.
 * @param req.query.practiceId The ID of AthenaHealth Practice.
 * @param req.query.departmentId The ID of AthenaHealth Department.
 * @param req.query.triggerDq Whether to trigger a data quality check.
 * @returns 200 OK
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const athenaPatientId = getFromQueryOrFail("patientId", req);
    const athenaPracticeId = getFromQueryOrFail("practiceId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    const triggerDq = getFromQueryAsBoolean("triggerDq", req);
    const isAppointment = getFromQueryAsBoolean("isAppointment", req);
    syncAthenaPatientIntoMetriport({
      cxId,
      athenaPracticeId,
      athenaPatientId,
      athenaDepartmentId,
      triggerDq,
      triggerDqForExistingPatient: isAppointment,
    }).catch(processAsyncError("AthenaHealth syncAthenaPatientIntoMetriport"));
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehr/athenahealth/patient/secondary-mappings/department-id
 *
 * Updates the department ID in the secondary mappings for an AthenaHealth patient mapping.
 *
 * @param req.query.cxId - The ID of the Metriport customer.
 * @param req.query.patientId - The ID of the AthenaHealth patient.
 * @param req.query.departmentId - The ID of the AthenaHealth department.
 * @returns 200 OK if the update is successful.
 */
router.post(
  "/secondary-mappings/department-id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const athenaPatientId = getFromQueryOrFail("patientId", req);
    const athenaDepartmentId = getFromQueryOrFail("departmentId", req);
    await updateAthenaPatientMappingDepartmentId({
      cxId,
      athenaPatientId,
      athenaDepartmentId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
