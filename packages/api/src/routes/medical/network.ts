import { Request, Response } from "express";
import Router from "express-promise-router";
import { OK } from "http-status";
import _ from "lodash";
import { requestLogger } from "../helpers/request-logger";
import { getPatientInfoOrFail, patientAuthorization } from "../middlewares/patient-authorization";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { asyncHandler, getFrom } from "../util";
import { networkQuerySchema } from "./schemas/network";
import { getSourceQueryStatus } from "../../command/medical/network/source-query";
import { queryDocumentsAcrossNetworks } from "../../command/medical/network/network-query";
import { getPatientPrimaryFacilityIdOrFail } from "../../command/medical/patient/get-patient-facilities";
import { networkSources, SourceQueryProgress } from "@metriport/core/domain/network-query";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /network/query
 *
 * Returns the network query status for the specified patient.
 *
 * @return The status of document querying across HIEs, pharmacies, and laboratories.
 */
router.get(
  "/query",
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId, patient } = getPatientInfoOrFail(req);

    const queryProgressPromises: Array<Promise<SourceQueryProgress | undefined>> = [];
    for (const source of networkSources) {
      queryProgressPromises.push(getSourceQueryStatus({ cxId, patientId, patient, source }));
    }
    const queryProgress = await Promise.all(queryProgressPromises);
    const networkQueryProgress = _(queryProgress).compact().value();

    return res.status(OK).json({
      sources: networkQueryProgress,
    });
  })
);

/** ---------------------------------------------------------------------------
 * POST /network/query
 *
 * Triggers a network query for the specified patient across HIEs, Surescripts (PBMs), and other integrations.
 *
 * @param req.query.facilityId An optional facility providing NPI for the network query.
 * @param req.body The body of the network query, which contains the sources to query along with any additional metadata.
 * @param req.body.sources Array of network sources to query (e.g., ["hie", "pharmacy", "laboratory"]).
 * @param req.body.override Whether to override files already downloaded (optional, defaults to false).
 * @param req.body.metadata Optional metadata to be sent through Webhook.
 * @param req.body.commonwell Optional flag to force Commonwell queries (HIE only).
 * @param req.body.carequality Optional flag to force Carequality queries (HIE only).
 * @return The status of the network query.
 */
router.post(
  "/query",
  checkRateLimit("documentQuery"),
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, id: patientId } = getPatientInfoOrFail(req);
    const facilityId = getFrom("query").optional("facilityId", req);
    const patientFacilityId =
      facilityId ?? (await getPatientPrimaryFacilityIdOrFail({ cxId, patientId }));

    const networkQuery = networkQuerySchema.parse(req.body);
    const networkQueryProgress = await queryDocumentsAcrossNetworks({
      ...networkQuery,
      cxId,
      patientId,
      facilityId: patientFacilityId,
    });

    return res.status(OK).json(networkQueryProgress);
  })
);
