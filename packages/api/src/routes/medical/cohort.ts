import {
  Cohort,
  cohortCreateSchema,
  CohortDTO,
  cohortPatientListQuerySchema,
  cohortPatientMaxPageSize,
  cohortUpdateSchema,
  dtoFromCohort,
} from "@metriport/shared/domain/cohort";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createCohort } from "../../command/medical/cohort/create-cohort";
import { deleteCohort } from "../../command/medical/cohort/delete-cohort";
import {
  getCohortByName,
  getCohorts,
  getCohortWithSizeOrFail,
} from "../../command/medical/cohort/get-cohort";
import {
  addAllPatientsToCohort,
  addPatientsToCohort,
} from "../../command/medical/cohort/patient-cohort/add-patients-to-cohort";
import {
  getPatientsInCohort,
  getPatientsInCohortCount,
} from "../../command/medical/cohort/patient-cohort/get-patients-in-cohort";
import { removePatientsFromCohort } from "../../command/medical/cohort/patient-cohort/remove-patients-from-cohort";
import { updateCohort } from "../../command/medical/cohort/update-cohort";
import { getETag } from "../../shared/http";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { paginatedV2 } from "../pagination-v2";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail, getFromQuery } from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { allOrSubsetPatientIdsSchema, patientIdsSchema } from "./schemas/shared";

const router = Router();

function applyCohortDtoToPayload(params: { cohort: Cohort }): { cohort: CohortDTO } {
  return {
    ...params,
    cohort: dtoFromCohort(params.cohort),
  };
}

/** ---------------------------------------------------------------------------
 * POST /medical/v1/cohort
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

    return res.status(status.CREATED).json({ cohort: dtoFromCohort(cohort), size: 0 });
  })
);

/** ---------------------------------------------------------------------------
 * PUT /medical/v1/cohort/:id
 *
 * Updates the settings of an existing cohort. This endpoint will
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

    const cohortWithSize = await updateCohort({
      ...getETag(req),
      ...data,
      cxId,
      id,
    });

    return res.status(status.OK).json(applyCohortDtoToPayload(cohortWithSize));
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /medical/v1/cohort/:id
 *
 * Deletes a cohort. All associated patients must be removed first.
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
 * GET /medical/v1/cohort
 *
 * Returns all cohorts defined by the CX. If a name is provided, returns the cohort with the specified name instead.
 *
 * @param req.query.name (optional) The name of the cohort to return.
 * @returns List of cohorts with count of patients assigned to them.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const name = getFromQuery("name", req);

    const cohorts = name ? [await getCohortByName({ cxId, name })] : await getCohorts({ cxId });

    return res.status(status.OK).json({
      cohorts: cohorts.map(dtoFromCohort),
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /medical/v1/cohort/:id
 *
 * Returns cohort with additional details; the count and IDs of the patients assigned to it.
 *
 * @param req.param.id The ID of the cohort to get.
 * @returns Cohort with additional details; the count and IDs of the patients assigned to it.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);

    const cohortWithSize = await getCohortWithSizeOrFail({ id, cxId });

    return res.status(status.OK).json(applyCohortDtoToPayload(cohortWithSize));
  })
);

/** ---------------------------------------------------------------------------
 * GET /medical/v1/cohort/:id/patient
 *
 * Returns patients assigned to a cohort with pagination support.
 *
 * @param req.param.id The ID of the cohort to get patients from.
 * @param req.query.fromItem Optional pagination parameter to start from a specific item.
 * @param req.query.toItem Optional pagination parameter to end at a specific item.
 * @param req.query.count Optional number of items per page (max 100).
 * @param req.query.sort Optional sort parameter (e.g., "id=asc,createdAt=desc").
 * @returns A paginated list of patients in the cohort.
 */
router.get(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const cohortId = getFromParamsOrFail("id", req);

    // Validate query parameters for pagination
    cohortPatientListQuerySchema.parse(req.query);

    const result = await paginatedV2({
      request: req,
      additionalQueryParams: undefined,
      getItems: async pagination => {
        return await getPatientsInCohort({
          cohortId,
          cxId,
          pagination,
        });
      },
      getTotalCount: async () => {
        return await getPatientsInCohortCount({
          cohortId,
          cxId,
        });
      },
      allowedSortColumns: {
        id: "patient",
        createdAt: "patient",
        updatedAt: "patient",
      },
      maxItemsPerPage: cohortPatientMaxPageSize,
    });

    return res.status(status.OK).json({
      meta: result.meta,
      patients: result.items.map(dtoFromModel),
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /medical/v1/cohort/:id/patient
 *
 * Add patients to a cohort.
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
    const cohortId = getUUIDFrom("params", req, "id").orFail();
    const body = allOrSubsetPatientIdsSchema.parse(req.body);

    if ("all" in body) {
      await addAllPatientsToCohort({
        cohortId,
        cxId,
      });
    } else {
      await addPatientsToCohort({
        cohortId,
        cxId,
        patientIds: body.patientIds,
      });
    }

    const cohortWithSize = await getCohortWithSizeOrFail({
      id: cohortId,
      cxId,
    });

    return res
      .status(status.CREATED)
      .json({ message: "Patient(s) added to cohort", ...applyCohortDtoToPayload(cohortWithSize) });
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /medical/v1/cohort/:id/patient
 *
 * Remove patients from a cohort.
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
    const cohortId = getUUIDFrom("params", req, "id").orFail();
    const patientIds = patientIdsSchema.parse(req.body.patientIds);

    await removePatientsFromCohort({
      cohortId,
      cxId,
      patientIds,
    });

    const cohortWithSize = await getCohortWithSizeOrFail({
      id: cohortId,
      cxId,
    });

    return res.status(status.OK).json({
      message: "Patient(s) removed from cohort",
      ...applyCohortDtoToPayload(cohortWithSize),
    });
  })
);

export default router;
