import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createCohort } from "../../command/medical/cohort/create-cohort";
import { deleteCohort } from "../../command/medical/cohort/delete-cohort";
import { getCohortWithCountOrFail, getCohorts } from "../../command/medical/cohort/get-cohort";
import {
  bulkAssignPatientsToCohort,
  bulkRemovePatientsFromCohort,
} from "../../command/medical/cohort/patient-cohort/patient-cohort";
import { updateCohort } from "../../command/medical/cohort/update-cohort";
import { getETag } from "../../shared/http";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromCohort } from "./dtos/cohortDTO";
import {
  bulkPatientAssignmentSchema,
  bulkPatientRemovalSchema,
  cohortCreateSchema,
  cohortUpdateSchema,
} from "./schemas/cohort";

const router = Router();

/** ---------------------------------------------------------------------------
 * POST /cohort
 *
 * Creates a new cohort.
 *
 * @param req.body The data to create the cohort.
 * @returns The newly created cohort.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const data = cohortCreateSchema.parse(req.body);

    const cohort = await createCohort({
      cxId,
      ...data,
    });

    return res.status(status.CREATED).json(dtoFromCohort(cohort));
  })
);

/** ---------------------------------------------------------------------------
 * PUT /cohort/:id
 *
 * Updates the settings of an existing cohort.
 *
 * @param req.body The data to update the cohort.
 * @returns The updated cohort.
 */
router.put(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
    const data = cohortUpdateSchema.parse(req.body);

    const cohort = await updateCohort({
      ...getETag(req),
      id,
      cxId,
      ...data,
    });

    return res.status(status.OK).json(dtoFromCohort(cohort));
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /cohort/:id
 *
 * Deletes a cohort. All associated patients must be unassigned first.
 *
 * @param req.param.id The ID of the cohort to delete.
 * @returns 204 No Content
 */
router.delete(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);

    await deleteCohort({
      id,
      cxId,
    });

    return res.sendStatus(status.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * GET /cohort
 *
 * Returns all cohorts defined by the CX.
 *
 * @returns List of cohorts and count.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const cohortsWithCounts = await getCohorts({ cxId });

    return res.status(status.OK).json({
      cohorts: cohortsWithCounts.map(cohortWithCount => {
        return {
          cohort: dtoFromCohort(cohortWithCount.cohort),
          patientCount: cohortWithCount.count,
        };
      }),
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /cohort/:id
 *
 * Returns cohort details and the count of patients assigned to it.
 *
 * @param req.param.id The ID of the cohort to get.
 * @returns Cohort details and count.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);

    const cohortWithCount = await getCohortWithCountOrFail({ id, cxId });

    return res.status(status.OK).json({
      cohort: dtoFromCohort(cohortWithCount.cohort),
      patientCount: cohortWithCount.count,
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /cohort/:id/patient
 *
 * Returns cohort details, count and IDs of the patients assigned to it.
 *
 * @param req.param.id The ID of the cohort to get.
 * @returns Cohort details and count.
 */
router.get(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);

    const cohortWithCount = await getCohortWithCountOrFail({ id, cxId });

    return res.status(status.OK).json({
      cohort: dtoFromCohort(cohortWithCount.cohort),
      patientCount: cohortWithCount.count,
      patientIds: cohortWithCount.patientIds,
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /cohort/:id/patient
 *
 * Bulk assign multiple patients to a cohort.
 *
 * @param req.param.id The ID of the cohort to assign patients to.
 * @param req.body The list of patient IDs to assign.
 * @returns Success status and count of assigned patients.
 */
router.post(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const cohortId = getFromParamsOrFail("id", req);
    const { patientIds } = bulkPatientAssignmentSchema.parse(req.body);

    const countAssigned = await bulkAssignPatientsToCohort({
      cohortId,
      cxId,
      patientIds,
    });

    return res
      .status(status.CREATED)
      .json({ message: "Patient(s) assigned to cohort", count: countAssigned });
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /cohort/:id/patient
 *
 * Bulk remove patients from a cohort.
 *
 * @param req.param.id The ID of the cohort to remove patients from.
 * @param req.body Either list of patient IDs or all flag.
 * @returns 204 No Content
 */
router.delete(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const cohortId = getFromParamsOrFail("id", req);
    const data = bulkPatientRemovalSchema.parse(req.body);

    const countUnassigned = await bulkRemovePatientsFromCohort({
      cohortId,
      cxId,
      data,
    });

    return res
      .sendStatus(status.NO_CONTENT)
      .json({ message: "Patient(s) unassigned from cohort", count: countUnassigned });
  })
);

export default router;
