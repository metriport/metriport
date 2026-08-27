import { NotFoundError } from "@metriport/shared";
import {
  datasourceQueryStatus,
  networkSourceSchema,
  specificSourceSchema,
} from "@metriport/shared/domain/network-query";
import { networkQueryBodySchema } from "@metriport/shared/domain/network-query/query";
import { toNetworkQueryStatusDto } from "@metriport/shared/domain/network-query/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  getNetworkQueryStatusByRequestId,
  startNetworkQuery,
} from "../../../command/medical/network-query/network-query";
import {
  updateDatasourceQueryStatusByPatients,
  updateDatasourceQueryStatusByRequestId,
} from "../../../command/medical/network-query/update-datasource-query-status";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../command/medical/patient/get-patient-facilities";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryOrFail } from "../../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /internal/network-query/:requestId
 *
 * Returns the network query status for a specific request.
 * Works the same as the public endpoint but accepts cxId as a query param.
 *
 * @param req.params.requestId - The unique request ID of the network query
 * @param req.query.cxId - The CX ID (for authorization)
 * @return The status of document querying across HIEs, pharmacies, and laboratories.
 */
router.get(
  "/:requestId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const requestId = getUUIDFrom("params", req, "requestId").orFail();

    const result = await getNetworkQueryStatusByRequestId({ cxId, requestId });
    if (!result) {
      throw new NotFoundError("Network query not found", undefined, { requestId });
    }

    return res.status(httpStatus.OK).json(toNetworkQueryStatusDto(result));
  })
);

const updateByRequestIdSchema = z.object({
  cxId: z.string().uuid(),
  requestId: z.string().uuid(),
  source: networkSourceSchema,
  specificSource: specificSourceSchema,
  toStatus: z.enum(datasourceQueryStatus),
});

const updateByPatientSchema = z.object({
  cxId: z.string().uuid(),
  patientId: z.string().uuid(),
  source: networkSourceSchema,
  specificSource: specificSourceSchema,
  fromStatuses: z.array(z.enum(datasourceQueryStatus)).optional(),
  toStatus: z.enum(datasourceQueryStatus),
  rosterId: z.string().uuid().optional(),
});

type UpdateByRequestId = z.infer<typeof updateByRequestIdSchema>;
type UpdateByPatient = z.infer<typeof updateByPatientSchema>;
type UpdateStatusBody = UpdateByRequestId | UpdateByPatient;

function isUpdateByRequestId(body: UpdateStatusBody): body is UpdateByRequestId {
  return "requestId" in body;
}

const updateStatusBodySchema = z.union([updateByRequestIdSchema, updateByPatientSchema]);

/** ---------------------------------------------------------------------------
 * POST /internal/network-query/status
 *
 * Updates the status of a specific source within network queries.
 * Called by lambdas and other services to update network query progress.
 *
 * Two modes:
 * 1. By requestId: Updates only the specific network query row (no fromStatuses needed)
 * 2. By cxId+patientId: Updates rows matching fromStatuses for that patient+source (optional fromStatuses)
 *
 * @param req.body.requestId - Optional: The unique request ID of the network query
 * @param req.body.cxId - Optional: The CX ID (required if no requestId)
 * @param req.body.patientId - Optional: The patient ID (required if no requestId)
 * @param req.body.source - The network source to update (hie, pharmacy, lab)
 * @param req.body.specificSource - The specific provider (e.g., "surescripts", "quest")
 * @param req.body.fromStatuses - Optional: Which statuses to update from (patient mode only, defaults inferred)
 * @param req.body.toStatus - The new status for this source
 * @param req.body.rosterId - Optional: Filter by rosterId in data field (for patient mode)
 * @returns 200 OK
 */
router.post(
  "/status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const body = updateStatusBodySchema.parse(req.body);

    if (isUpdateByRequestId(body)) {
      const result = await updateDatasourceQueryStatusByRequestId({
        cxId: body.cxId,
        requestId: body.requestId,
        source: body.source,
        specificSource: body.specificSource,
        toStatus: body.toStatus,
      });
      return res.status(httpStatus.OK).json({ updatedCount: result.updatedCount });
    }

    const result = await updateDatasourceQueryStatusByPatients({
      patients: [{ cxId: body.cxId, patientId: body.patientId }],
      source: body.source,
      specificSource: body.specificSource,
      fromStatuses: body.fromStatuses,
      toStatus: body.toStatus,
      rosterId: body.rosterId,
    });
    return res.status(httpStatus.OK).json({ updatedCount: result.updatedCount });
  })
);

const bulkPatientSchema = z.object({
  cxId: z.string().uuid(),
  patientId: z.string().uuid(),
});
const bulkUpdateBodySchema = z.object({
  patients: z.array(bulkPatientSchema).min(1).max(50_000),
  source: networkSourceSchema,
  specificSource: specificSourceSchema,
  fromStatuses: z.array(z.enum(datasourceQueryStatus)).optional(),
  toStatus: z.enum(datasourceQueryStatus),
  rosterId: z.string().uuid().optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/network-query/status/bulk
 *
 * Bulk updates the status of a specific source for multiple patients.
 * More efficient than individual updates when processing large rosters.
 *
 * @param req.body.patients - Array of { cxId, patientId } to update
 * @param req.body.source - The network source to update (hie, pharmacy, lab)
 * @param req.body.specificSource - The specific provider (e.g., "surescripts", "quest")
 * @param req.body.fromStatuses - Optional: Which statuses to update from (defaults inferred from toStatus and source)
 * @param req.body.toStatus - The new status for this source
 * @param req.body.rosterId - Optional: Filter by rosterId in data field
 * @returns 200 OK with { updatedCount, patientsUpdated, patientsNotFound }
 */
router.post(
  "/status/bulk",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const body = bulkUpdateBodySchema.parse(req.body);

    const result = await updateDatasourceQueryStatusByPatients({
      patients: body.patients,
      source: body.source,
      specificSource: body.specificSource,
      fromStatuses: body.fromStatuses,
      toStatus: body.toStatus,
      rosterId: body.rosterId,
    });

    return res.status(httpStatus.OK).json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/network-query/query
 *
 * Triggers a network query for the specified patient across HIEs, Surescripts (PBMs),
 * and other integrations.
 *
 * @param req.query.cxId - The customer ID
 * @param req.query.patientId - The patient ID
 * @param req.query.facilityId - Optional facility ID providing NPI for the network query
 * @param req.body.sources - Array of network sources to query (e.g., ["hie", "pharmacy", "laboratory"])
 * @param req.body.override - Whether to override files already downloaded (optional, defaults to false)
 * @param req.body.metadata - Optional metadata to be sent through Webhook
 * @param req.body.commonwell - Optional flag to force Commonwell queries (HIE only)
 * @param req.body.carequality - Optional flag to force Carequality queries (HIE only)
 * @return The network query result with requestId and status
 */
router.post(
  "/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const facilityId = getFrom("query").optional("facilityId", req);

    await getPatientOrFail({ cxId, id: patientId });

    const patientFacilityId =
      facilityId ?? (await getPatientPrimaryFacilityIdOrFail({ cxId, patientId }));

    const body = networkQueryBodySchema.parse(req.body);
    const requestId = uuidv4();

    const result = await startNetworkQuery({
      requestId,
      cxId,
      patientId,
      facilityId: patientFacilityId,
      ...body,
    });

    return res.status(httpStatus.OK).json(result);
  })
);

export default router;
