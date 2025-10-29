import {
  cohortCreateSchema,
  cohortPatientListQuerySchema,
  cohortPatientMaxPageSize,
  cohortUpdateSchema,
  CohortWithSize,
  CohortWithSizeDTO,
  dtoFromCohort,
} from "@metriport/shared/domain/cohort";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createCohort } from "../../command/medical/cohort/create-cohort";
import { deleteCohort } from "../../command/medical/cohort/delete-cohort";
import { getCohorts, getCohortWithSizeOrFail } from "../../command/medical/cohort/get-cohort";
import {
  addAllPatientsToCohort,
  addPatientsToCohort,
} from "../../command/medical/cohort/patient-cohort/add-patients-to-cohort";
import {
  getPatientsInCohort,
  getPatientsInCohortCount,
} from "../../command/medical/cohort/patient-cohort/get-patients-in-cohort";
import {
  removeAllPatientsFromCohort,
  removePatientsFromCohort,
} from "../../command/medical/cohort/patient-cohort/remove-patients-from-cohort";
import { updateCohort } from "../../command/medical/cohort/update-cohort";
import { getETag } from "../../shared/http";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { paginatedV2 } from "../pagination-v2";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getCxIdOrFail, getFromParamsOrFail } from "../util";
import { dtoFromModel } from "./dtos/patientDTO";
import { allOrSubsetPatientIdsSchema } from "./schemas/shared";

const router = Router();

export function applyCohortDtoToPayload(data: CohortWithSize): CohortWithSizeDTO {
  const { size, ...cohort } = data;
  const cohortDto = dtoFromCohort(cohort);

  return { ...cohortDto, size };
}

/** ---------------------------------------------------------------------------
 * POST cohort
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

    // In the current implementation size will always be 0. But we'll keep the logic here for future use.
    const size = await getPatientsInCohortCount({
      cohortId: cohort.id,
      cxId,
    });

    return res.status(status.CREATED).json(applyCohortDtoToPayload({ ...cohort, size }));
  })
);

/** ---------------------------------------------------------------------------
 * PUT cohort/:id
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
 * DELETE cohort/:id
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
 * GET cohort
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

    const cohorts = await getCohorts({ cxId });

    return res.status(status.OK).json({
      cohorts: cohorts.map(applyCohortDtoToPayload),
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET cohort/:id
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
 * GET cohort/:id/patient
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
 * POST cohort/:id/patient
 *
 * Adds patients to a cohort. If the allPatients flag is true, all patients will be added to the cohort. Returns the cohort.
 *
 * @param req.param.id The ID of the cohort to assign patients to.
 * @param req.body.patientIds The list of patient IDs to assign. Mutually exclusive with the all flag.
 * @param req.body.all Flag to confirm we want to assign all patients to the cohort. Mutually exclusive with the patientIds list.
 *
 * @returns Cohort with the updated patient count.
 */
router.post(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const cohortId = getUUIDFrom("params", req, "id").orFail();
    const body = allOrSubsetPatientIdsSchema.parse(req.body);

    if ("allPatients" in body) {
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
 * DELETE cohort/:id/patient
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
    const body = allOrSubsetPatientIdsSchema.parse(req.body);

    if ("allPatients" in body) {
      await removeAllPatientsFromCohort({
        cohortId,
        cxId,
      });
    } else {
      await removePatientsFromCohort({
        cohortId,
        cxId,
        patientIds: body.patientIds,
      });
    }

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
