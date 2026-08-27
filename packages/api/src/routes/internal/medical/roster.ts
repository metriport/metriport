import { Config } from "@metriport/core/util/config";
import { rosterStatus } from "@metriport/shared";
import { allPatientsSchema, subsetPatientIdsSchema } from "@metriport/shared/domain/patient-or-all";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { createRoster } from "../../../command/medical/roster/create-roster";
import { deleteRoster } from "../../../command/medical/roster/delete-roster";
import {
  getCxIdFromRosterIdOrFail,
  getLatestRoster,
  getRosterOrFail,
  listRosters,
} from "../../../command/medical/roster/get-roster";
import { assignPatientsAndCreateRoster } from "../../../command/medical/roster/patient-roster/assign-patients-and-create-roster";
import { assignPatientsToRoster } from "../../../command/medical/roster/patient-roster/assign-patients-to-roster";
import { getPatientIdsOnRoster } from "../../../command/medical/roster/patient-roster/get-roster-patient-ids";
import { getRosterSize } from "../../../command/medical/roster/patient-roster/get-roster-size";
import { removePatientsFromRoster } from "../../../command/medical/roster/patient-roster/remove-patients-from-roster";
import { updateRoster } from "../../../command/medical/roster/update-roster";
import { Pagination } from "../../../command/pagination";
import { requestLogger } from "../../helpers/request-logger";
import { paginated } from "../../pagination";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler } from "../../util";

const router = Router();

const getLatestRosterSchema = z.object({
  source: z.string(),
  type: z.string(),
  status: z.enum(rosterStatus).optional(),
});

// This route must come before GET /:id
/** ---------------------------------------------------------------------------
 * GET /internal/roster/latest
 *
 * Get the latest roster by source and type.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.source The source of the roster.
 * @param req.query.type The type of the roster.
 * @param req.query.status The status of the roster (optional).
 * @returns The latest roster.
 */
router.get(
  "/latest",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const data = getLatestRosterSchema.parse(req.query);

    const roster = await getLatestRoster({
      cxId,
      source: data.source,
      type: data.type,
      ...(data.status ? { status: data.status } : {}),
    });

    return res.status(status.OK).json(roster);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/roster/:id
 *
 * Get a roster by ID.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The roster ID.
 * @returns The roster.
 */
router.get(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("params", req, "id").orFail();

    const roster = await getRosterOrFail({ rosterId, cxId });

    return res.status(status.OK).json(roster);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/roster/:id/cx-id
 *
 * Get the customer ID from a roster.
 *
 * @param req.params.id The ID of the roster to get the customer ID from.
 * @returns The customer ID.
 */
router.get(
  "/:id/cx-id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const rosterId = getUUIDFrom("params", req, "id").orFail();
    const cxId = await getCxIdFromRosterIdOrFail(rosterId);
    return res.status(status.OK).json({ cxId });
  })
);

const createRosterSchema = z.object({
  source: z.string(),
  type: z.string(),
  data: z.unknown().optional(),
  status: z.enum(rosterStatus).optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/roster
 *
 * Creates a new roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body.source The source of the roster.
 * @param req.body.type The type of the roster.
 * @param req.body.data The data of the roster (optional).
 * @param req.body.status The status of the roster (optional).
 * @returns The newly created roster.
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const data = createRosterSchema.parse(req.body);

    const roster = await createRoster({
      cxId,
      source: data.source,
      type: data.type,
      data: data.data,
      status: data.status,
    });

    return res.status(status.CREATED).json(roster);
  })
);

const updateRosterSchema = z.object({
  status: z.enum(rosterStatus).optional(),
  data: z.unknown().optional(),
});

/** ---------------------------------------------------------------------------
 * PATCH /internal/roster/:id
 *
 * Updates an existing roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The roster ID to update.
 * @param req.body.status The status of the roster (optional).
 * @param req.body.data The data of the roster (optional).
 * @returns The updated roster.
 */
router.patch(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("params", req, "id").orFail();
    const data = updateRosterSchema.parse(req.body);

    const roster = await updateRoster({
      rosterId,
      cxId,
      status: data.status,
      data: data.data,
    });

    return res.status(status.OK).json(roster);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/roster/:id
 *
 * Deletes a roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The roster ID.
 * @returns No Content.
 */
router.delete(
  "/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("params", req, "id").orFail();

    await deleteRoster({ rosterId, cxId });

    return res.sendStatus(status.NO_CONTENT);
  })
);

const assignAndCreateRosterSchema = createRosterSchema.omit({ status: true });
const assignAndCreateSchema = z.union([
  assignAndCreateRosterSchema.merge(subsetPatientIdsSchema),
  assignAndCreateRosterSchema.merge(allPatientsSchema),
]);

/** ---------------------------------------------------------------------------
 * POST /internal/roster/assign-and-create
 *
 * Assigns patients to a roster. If the roster doesn't exist, creates it first.
 *
 * @param req.query.cxId The customer ID.
 * @param req.body.source The source of the roster.
 * @param req.body.type The type of the roster.
 * @param req.body.data The data of the roster (optional).
 * @param req.body.patientIds The patient IDs to assign.
 * @param req.body.allPatients Whether to assign all patients.
 * @returns The roster and the number of patients assigned.
 */
router.post(
  "/assign-and-create",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const data = assignAndCreateSchema.parse(req.body);

    const { roster, count } = await assignPatientsAndCreateRoster({
      cxId,
      source: data.source,
      type: data.type,
      data: data.data,
      patientIds: "patientIds" in data ? data.patientIds : undefined,
      allPatients: "allPatients" in data ? data.allPatients : undefined,
    });

    return res.status(status.CREATED).json({ roster, count });
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/roster/:id/patient
 *
 * This is a paginated route.
 *
 * Get the patient IDs from a roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The ID of the roster to get the patient IDs from.
 * @param req.query.fromItem The minimum item to be included in the response, inclusive.
 * @param req.query.toItem The maximum item to be included in the response, inclusive.
 * @param req.query.count The number of items to be included in the response.
 * @returns The paginated list of patient IDs.
 */
router.get(
  "/:id/patient",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("params", req, "id").orFail();
    const { meta, items } = await paginated({
      request: req,
      additionalQueryParams: { cxId },
      getItems: async (pagination: Pagination) => {
        const patientIds = await getPatientIdsOnRoster({
          rosterId,
          cxId,
          pagination,
        });
        return patientIds.map(id => ({ id }));
      },
      getTotalCount: () => getRosterSize({ rosterId, cxId }),
      hostUrl: Config.getApiLoadBalancerAddress(),
    });
    // TODO: Migrate to use the new pagination endpoint.
    meta.nextPage = meta.nextPage?.replace("/:id", `/${rosterId}`);
    meta.prevPage = meta.prevPage?.replace("/:id", `/${rosterId}`);
    return res.status(status.OK).json({ meta, patientIds: items.map(item => item.id) });
  })
);

const listRostersSchema = z.object({
  source: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(rosterStatus).optional(),
});

/** ---------------------------------------------------------------------------
 * GET /internal/roster
 *
 * Lists all rosters for a given customer.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query Optional filter parameters (source, type, status).
 * @returns 200 with the list of rosters on the body under `rosters`.
 */
router.get(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const data = listRostersSchema.parse(req.query);

    const rosters = await listRosters({
      cxId,
      ...(data.source ? { source: data.source } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.status ? { status: data.status } : {}),
    });

    return res.status(status.OK).json({ rosters });
  })
);

const overrideCloseSchema = z.object({ overrideClose: z.boolean().optional() });
const assignOrRemovePatientsToRosterSchema = z.union([
  overrideCloseSchema.merge(subsetPatientIdsSchema),
  overrideCloseSchema.merge(allPatientsSchema),
]);

/** ---------------------------------------------------------------------------
 * POST /internal/roster/:id/patient
 *
 * Bulk assign multiple patients to a roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The ID of the roster to assign patients to.
 * @param req.body.patientIds The patient IDs to assign.
 * @param req.body.allPatients Whether to assign all patients.
 * @returns The number of patients assigned.
 */
router.post(
  "/:id/patient",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("params", req, "id").orFail();
    const data = assignOrRemovePatientsToRosterSchema.parse(req.body);

    const size = await assignPatientsToRoster({
      rosterId,
      cxId,
      patientIds: "patientIds" in data ? data.patientIds : undefined,
      allPatients: "allPatients" in data ? data.allPatients : undefined,
      overrideClose: data.overrideClose,
    });

    return res.status(status.CREATED).json({ size });
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/roster/:id/patient
 *
 * Bulk remove multiple patients from a roster.
 *
 * @param req.query.cxId The customer ID.
 * @param req.params.id The ID of the roster to remove patients from.
 * @param req.body.patientIds The patient IDs to remove.
 * @param req.body.allPatients Whether to remove all patients.
 * @returns The number of patients removed.
 */
router.delete(
  "/:id/patient",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const rosterId = getUUIDFrom("params", req, "id").orFail();
    const data = assignOrRemovePatientsToRosterSchema.parse(req.body);

    const size = await removePatientsFromRoster({
      rosterId,
      cxId,
      patientIds: "patientIds" in data ? data.patientIds : undefined,
      allPatients: "allPatients" in data ? data.allPatients : undefined,
      overrideClose: data.overrideClose,
    });

    return res.status(status.OK).json({ size });
  })
);

export default router;
