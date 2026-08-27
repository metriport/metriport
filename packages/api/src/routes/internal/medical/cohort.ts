import { Config } from "@metriport/core/util/config";
import { cohortPatientMaxPageSize } from "@metriport/shared/domain/cohort";
import { allOrSubsetPatientIdsSchema } from "@metriport/shared/domain/patient-or-all";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { createCohort } from "../../../command/medical/cohort/create-cohort";
import { deleteCohort } from "../../../command/medical/cohort/delete-cohort";
import {
  getAllOverridesForCohort,
  getCohortByNameOrFail,
  getCohortWithSize,
  listCohortsWithSizes,
} from "../../../command/medical/cohort/get-cohort";
import {
  addAllPatientsToCohort,
  addPatientsToCohort,
} from "../../../command/medical/cohort/patient-cohort/add-patients-to-cohort";
import { getCohortSize } from "../../../command/medical/cohort/patient-cohort/get-cohort-size";
import { getPatientsInCohort } from "../../../command/medical/cohort/patient-cohort/get-patients-in-cohort";
import {
  removeAllPatientsFromCohort,
  removePatientsFromCohort,
} from "../../../command/medical/cohort/patient-cohort/remove-patients-from-cohort";
import { updateCohort } from "../../../command/medical/cohort/update-cohort";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import {
  cohortCreateSchema,
  cohortPatientListQuerySchema,
  cohortUpdateSchema,
} from "../../medical/schemas/cohort";
import { paginatedV2 } from "../../pagination-v2";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFromParamsOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/cohort
 *
 * Creates a new cohort.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body The data to create the cohort.
 * @returns The newly created cohort.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const data = cohortCreateSchema.parse(req.body);

    const cohort = await createCohort({
      cxId,
      ...data,
    });

    const size = await getCohortSize({
      cohortId: cohort.id,
      cxId,
    });

    return res.status(status.CREATED).json({ ...cohort, size });
  })
);

/** ---------------------------------------------------------------------------
 *
 * PATCH /internal/cohort/:id
 *
 * Updates a cohort's settings.
 * As a PATCH, this takes partial settings instead of the entire cohort object.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The ID of the cohort to update.
 * @param req.body The new cohort settings.
 * @returns The updated cohort.
 */
router.patch(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getUUIDFrom("params", req, "id").orFail();

    const cohortData = cohortUpdateSchema.parse(req.body);

    const cohortWithSize = await updateCohort({ id, cxId, ...cohortData });

    return res.status(status.OK).json(cohortWithSize);
  })
);

/** ---------------------------------------------------------------------------
 *
 * GET /internal/cohort/name/:name
 *
 * Gets a cohort by name.
 *
 * @param req.params.name The name of the cohort to get.
 * @param req.query.cxId The ID of the CX.
 * @returns The cohort.
 */
router.get(
  "/name/:name",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const name = getFromParamsOrFail("name", req);
    const cohort = await getCohortByNameOrFail({ cxId, name });
    return res.status(status.OK).json(cohort);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/cohort/overrides
 *
 * Returns the available overrides for a cohort.
 *
 * @param req.query.cxId The customer ID.
 * @param req.param.cohortId The ID of the cohort to get overrides for.
 * @returns The available overrides for a cohort.
 */
router.get(
  "/:cohortId/overrides",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const cohortId = getUUIDFrom("params", req, "cohortId").orFail();
    const overrides = await getAllOverridesForCohort({ cohortId, cxId });
    return res.status(status.OK).json(overrides);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/cohort/:id
 *
 * Deletes a cohort. All associated patients must be removed first.
 *
 * @param req.query.cxId The customer ID.
 * @param req.param.id The ID of the cohort to delete.
 * @returns 204 No Content
 */
router.delete(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getUUIDFrom("params", req, "id").orFail();

    await deleteCohort({
      cohortId: id,
      cxId,
    });

    return res.sendStatus(status.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/cohort
 *
 * Returns all cohorts defined by the CX.
 *
 * @param req.query.cxId The customer ID.
 * @returns List of cohorts with count of patients assigned to them.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();

    const cohortsWithSizes = await listCohortsWithSizes({ cxId });

    return res.status(status.OK).json({
      cohorts: cohortsWithSizes,
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/cohort/:id
 *
 * Returns cohort with additional details and the count of patients assigned to it.
 *
 * @param req.query.cxId The customer ID.
 * @param req.param.id The ID of the cohort to get.
 * @returns Cohort with additional details and the count of patients assigned to it.
 */
router.get(
  "/:id",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getUUIDFrom("params", req, "id").orFail();

    const cohortWithSize = await getCohortWithSize({ cohortId: id, cxId });

    return res.status(status.OK).json(cohortWithSize);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/cohort/:id/patient
 *
 * Returns patients assigned to a cohort with pagination support.
 *
 * @param req.query.cxId The customer ID.
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
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const cohortId = getUUIDFrom("params", req, "id").orFail();

    cohortPatientListQuerySchema.parse(req.query);

    const result = await paginatedV2({
      request: req,
      additionalQueryParams: { cxId },
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
      hostUrl: Config.getApiLoadBalancerAddress(),
    });

    return res.status(status.OK).json({
      meta: result.meta,
      patients: result.items,
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/cohort/:id/patient
 *
 * Adds patients to a cohort. If the allPatients flag is true, all patients will be added to the cohort. Returns the cohort.
 *
 * @param req.query.cxId The customer ID.
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
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
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
      cohort: cohortWithSize,
    });
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/cohort/:id/patient
 *
 * Remove patients from a cohort.
 *
 * @param req.query.cxId The customer ID.
 * @param req.param.id The ID of the cohort to remove patients from.
 * @param req.body.patientIds The list of patient IDs to remove. Mutually exclusive with the allPatients flag.
 * @param req.body.allPatients Flag to confirm we want to remove all patients from the cohort. Mutually exclusive with the patientIds list.
 * @returns Cohort with the updated patient count.
 */
router.delete(
  "/:id/patient",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
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
      cohort: cohortWithSize,
    });
  })
);

export default router;
