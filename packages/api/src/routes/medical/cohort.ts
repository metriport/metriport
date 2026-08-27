import {
  CohortWithSize,
  CohortWithSizeResponseWithoutOverrides,
  cohortPatientMaxPageSize,
  responseDtoFromCohort,
} from "@metriport/shared/domain/cohort";
import { allOrSubsetPatientIdsSchema } from "@metriport/shared/domain/patient-or-all";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { deleteCohort } from "../../command/medical/cohort/delete-cohort";
import { getCohortWithSize, listCohortsWithSizes } from "../../command/medical/cohort/get-cohort";
import {
  addAllPatientsToCohort,
  addPatientsToCohort,
} from "../../command/medical/cohort/patient-cohort/add-patients-to-cohort";
import { getCohortSize } from "../../command/medical/cohort/patient-cohort/get-cohort-size";
import { getPatientsInCohort } from "../../command/medical/cohort/patient-cohort/get-patients-in-cohort";
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
import { asyncHandler, getCxIdOrFail } from "../util";
import { cohortPatientListQuerySchema, cohortUpdateSchemaWithoutSettings } from "./schemas/cohort";

const router = Router();

export function applyCohortResponseDtoToPayload(
  data: CohortWithSize
): CohortWithSizeResponseWithoutOverrides {
  const { size, ...cohort } = data;
  const cohortResponse = responseDtoFromCohort(cohort);
  return { ...cohortResponse, size };
}

/**
 * PATCH /cohort/:id
 *
 * Updates basic fields of an existing cohort (name, description, etc.).
 * This endpoint does NOT allow updating cohort settings.
 * Please contact us if you need to update cohort settings.
 *
 * @param req.param.id The ID of the cohort to update.
 * @param req.body The partial cohort fields to update (excluding settings).
 * @returns The updated cohort.
 */
router.patch(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getUUIDFrom("params", req, "id").orFail();
    const data = cohortUpdateSchemaWithoutSettings.parse(req.body);
    const cohortWithSize = await updateCohort({
      ...getETag(req),
      ...data,
      cxId,
      id,
    });

    return res.status(status.OK).json(applyCohortResponseDtoToPayload(cohortWithSize));
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /cohort/:id
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
    const id = getUUIDFrom("params", req, "id").orFail();

    await deleteCohort({
      cohortId: id,
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

    const cohortsWithSizes = await listCohortsWithSizes({ cxId });

    return res.status(status.OK).json({
      cohorts: cohortsWithSizes.map(applyCohortResponseDtoToPayload),
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /cohort/:id
 *
 * Returns cohort with additional details and the count of patients assigned to it.
 *
 * @param req.param.id The ID of the cohort to get.
 * @returns Cohort with additional details and the count of patients assigned to it.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getUUIDFrom("params", req, "id").orFail();
    const cohortWithSize = await getCohortWithSize({ cohortId: id, cxId });

    return res.status(status.OK).json(applyCohortResponseDtoToPayload(cohortWithSize));
  })
);

/** ---------------------------------------------------------------------------
 * GET /cohort/:id/patient
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
    const cohortId = getUUIDFrom("params", req, "id").orFail();

    cohortPatientListQuerySchema.parse(req.query);

    const result = await paginatedV2({
      request: req,
      additionalQueryParams: undefined,
      getItems: async pagination => {
        const patients = await getPatientsInCohort({
          cohortId,
          cxId,
          pagination,
        });
        return patients.map(p => ({
          ...p,
        }));
      },
      getTotalCount: () => getCohortSize({ cohortId, cxId }),
      allowedSortColumns: {
        id: { table: "patient", column: "id", type: "regular" },
        createdAt: { table: "patient", column: "created_at", type: "regular" },
        updatedAt: { table: "patient", column: "updated_at", type: "regular" },
      },
      maxItemsPerPage: cohortPatientMaxPageSize,
    });

    return res.status(status.OK).json({
      meta: result.meta,
      patients: result.items,
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /cohort/:id/patient
 *
 * Adds patients to a cohort. If the allPatients flag is true, all patients will be added to the cohort. Returns the cohort.
 *
 * @param req.param.id The ID of the cohort to assign patients to.
 * @param req.body.patientIds The list of patient IDs to assign. Mutually exclusive with the allPatients flag.
 * @param req.body.allPatients Flag to confirm we want to assign all patients to the cohort. Mutually exclusive with the patientIds list.
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

    const cohortWithSize = await getCohortWithSize({
      cohortId,
      cxId,
    });

    return res.status(status.CREATED).json({
      message: "Patient(s) added to cohort",
      cohort: applyCohortResponseDtoToPayload(cohortWithSize),
    });
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /cohort/:id/patient
 *
 * Remove patients from a cohort.
 *
 * @param req.param.id The ID of the cohort to remove patients from.
 * @param req.body.patientIds The list of patient IDs to remove. Mutually exclusive with the allPatients flag.
 * @param req.body.allPatients Flag to confirm we want to remove all patients from the cohort. Mutually exclusive with the patientIds list.
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

    const cohortWithSize = await getCohortWithSize({
      cohortId,
      cxId,
    });

    return res.status(status.OK).json({
      message: "Patient(s) removed from cohort",
      cohort: applyCohortResponseDtoToPayload(cohortWithSize),
    });
  })
);

export default router;
