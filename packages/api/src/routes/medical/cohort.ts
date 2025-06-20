import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createCohort } from "../../command/medical/cohort/create-cohort";
import { deleteCohort } from "../../command/medical/cohort/delete-cohort";
import {
  CohortWithCount,
  getCohorts,
  getCohortWithCountOrFail,
} from "../../command/medical/cohort/get-cohort";
import { bulkAssignPatientsToCohort } from "../../command/medical/cohort/patient-cohort/bulk-assign";
import { bulkRemovePatientsFromCohort } from "../../command/medical/cohort/patient-cohort/bulk-remove";
import { updateCohort } from "../../command/medical/cohort/update-cohort";
import { getETag } from "../../shared/http";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import {
  CohortWithCountDTO,
  CohortWithPatientIdsAndCountDTO,
  dtoFromCohort,
} from "./dtos/cohortDTO";
import { cohortCreateSchema, cohortUpdateSchema } from "./schemas/cohort";
import { bulkPatientCohortSchema } from "./schemas/patient-cohort";

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
 * @returns List of cohorts with count of patients assigned to them.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const cohortsWithCounts = await getCohorts({ cxId });

    const buildCohortWithCountDTO = (cohortWithCount: CohortWithCount): CohortWithCountDTO => {
      return {
        cohort: dtoFromCohort(cohortWithCount.cohort),
        patientCount: cohortWithCount.count,
      };
    };

    return res.status(status.OK).json({
      cohorts: cohortsWithCounts.map(buildCohortWithCountDTO),
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /cohort/:id
 *
 * Returns cohort details, count and IDs of the patients assigned to it.
 *
 * @param req.param.id The ID of the cohort to get.
 * @returns Cohort details, count and IDs of the patients assigned to it.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);

    const cohortDetails = await getCohortWithCountOrFail({ id, cxId });

    const cohortWithPatientIdsAndCountDTO: CohortWithPatientIdsAndCountDTO = {
      cohort: dtoFromCohort(cohortDetails.cohort),
      patientCount: cohortDetails.count,
      patientIds: cohortDetails.patientIds,
    };

    return res.status(status.OK).json(cohortWithPatientIdsAndCountDTO);
  })
);

/** ---------------------------------------------------------------------------
 * POST /cohort/:id/patient
 *
 * Bulk assign multiple patients to a cohort.
 *
 * @param req.param.id The ID of the cohort to assign patients to.
 * @param req.body.patientIds The list of patient IDs to assign. Mutually exclusive with the all flag.
 * @param req.body.all Flag to confirm we want to assign all patients to the cohort. Mutually exclusive with the patientIds list.
 *
 * @returns Cohort details with the updated patient IDs and count.
 */
router.post(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const cohortId = getFromParamsOrFail("id", req);
    const { patientIds, all: isAssignAll } = bulkPatientCohortSchema.parse(req.body);

    const cohortDetails = await bulkAssignPatientsToCohort({
      cohortId,
      cxId,
      patientIds,
      isAssignAll,
    });

    const cohortWithPatientIdsAndCountDTO: CohortWithPatientIdsAndCountDTO = {
      cohort: dtoFromCohort(cohortDetails.cohort),
      patientCount: cohortDetails.count,
      patientIds: cohortDetails.patientIds,
    };

    return res.status(status.CREATED).json(cohortWithPatientIdsAndCountDTO);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /cohort/:id/patient
 *
 * Bulk remove patients from a cohort.
 *
 * @param req.param.id The ID of the cohort to remove patients from.
 * @param req.body.patientIds The list of patient IDs to remove. Mutually exclusive with the all flag.
 * @param req.body.all Flag to confirm we want to remove all patients from the cohort. Mutually exclusive with the patientIds list.
 * @returns 204 No Content
 */
router.delete(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const cohortId = getFromParamsOrFail("id", req);
    const { patientIds, all: isRemoveAll } = bulkPatientCohortSchema.parse(req.body);

    const unassignedCount = await bulkRemovePatientsFromCohort({
      cohortId,
      cxId,
      patientIds,
      isRemoveAll,
    });

    return res
      .status(status.NO_CONTENT)
      .json({ message: "Patient(s) unassigned from cohort", unassignedCount });
  })
);

export default router;
