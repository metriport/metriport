import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { networkQueryBodySchema } from "@metriport/shared/domain/network-query/query";
import { toNetworkQueryStatusDto } from "@metriport/shared/domain/network-query/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { OK } from "http-status";
import {
  getNetworkQueryStatusByRequestId,
  startNetworkQuery,
} from "../../command/medical/network-query/network-query";
import { getPatientPrimaryFacilityIdOrFail } from "../../command/medical/patient/get-patient-facilities";
import { requestLogger } from "../helpers/request-logger";
import { getPatientInfoOrFail, patientAuthorization } from "../middlewares/patient-authorization";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getCxIdOrFail, getFrom } from "../util";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /network/query/:requestId
 *
 * Returns the network query status for a specific request.
 *
 * @param req.params.requestId - The unique request ID returned from POST /network/query
 * @return The status of document querying across HIEs, pharmacies, and laboratories.
 */
router.get(
  "/query/:requestId",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const requestId = getUUIDFrom("params", req, "requestId").orFail();

    const result = await getNetworkQueryStatusByRequestId({ cxId, requestId });
    if (!result) {
      throw new NotFoundError("Network query not found", undefined, { requestId });
    }

    return res.status(OK).json(toNetworkQueryStatusDto(result));
  })
);

/** ---------------------------------------------------------------------------
 * POST /network/query
 *
 * Triggers a network query for the specified patient across HIEs, Surescripts (PBMs), and other integrations.
 *
 * @param req.query.facilityId An optional facility providing NPI for the network query.
 * @param req.body The body of the network query, which contains the sources to query along with any additional metadata.
 * @param req.body.sources Array of network sources to query (e.g., ["hie", "pharmacy", "lab"]).
 * @param req.body.override Whether to override files already downloaded (optional, defaults to false).
 * @param req.body.metadata Optional metadata to be sent through Webhook.
 * @param req.body.commonwell Optional flag to force Commonwell queries (HIE only).
 * @param req.body.carequality Optional flag to force Carequality queries (HIE only).
 * @return The requestId and initial status of the network query.
 */
router.post(
  "/query",
  checkRateLimit("documentQuery"),
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const facilityId = getFrom("query").optional("facilityId", req);

    // TODO ENG-618: Temporary fix until we make facilityId required in the API
    const patientFacilityId =
      facilityId ?? (await getPatientPrimaryFacilityIdOrFail({ cxId, patientId }));

    const networkQueryBody = networkQueryBodySchema.parse(req.body);
    const requestId = uuidv7();

    const result = await startNetworkQuery({
      ...networkQueryBody,
      requestId,
      cxId,
      patientId,
      facilityId: patientFacilityId,
    });

    return res.status(OK).json(toNetworkQueryStatusDto(result));
  })
);

export default router;
