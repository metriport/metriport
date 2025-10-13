import { Request, Response } from "express";
import Router from "express-promise-router";
import { OK } from "http-status";
import _ from "lodash";
import { requestLogger } from "../helpers/request-logger";
import { getPatientInfoOrFail, patientAuthorization } from "../middlewares/patient-authorization";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { asyncHandler, getFrom } from "../util";
import { networkQuerySchema } from "./schemas/network";
import { queryDocumentsAcrossSource } from "../../command/medical/network/source-query";
import { getPatientPrimaryFacilityIdOrFail } from "../../command/medical/patient/get-patient-facilities";
import { SourceQueryProgress } from "@metriport/core/domain/network-query";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /network/query
 *
 * Returns the network query status for the specified patient.
 *
 * @param req.query.patientId Patient ID for which to retrieve document query status.
 * @return The status of document querying across HIEs.
 */
router.get(
  "/query",
  requestLogger,
  patientAuthorization("query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { patient } = getPatientInfoOrFail(req);
    // TODO: convert documentQueryProgress to networkQueryProgress
    return res.status(OK).json(patient.data.documentQueryProgress ?? {});
  })
);

/** ---------------------------------------------------------------------------
 * POST /network/query
 *
 * Triggers a network query for the specified patient across HIEs, Surescripts (PBMs), and other integrations.
 *
 * @param req.query.patientId Patient ID for which to retrieve network metadata.
 * @param req.query.facilityId The facility providing NPI for the network query.
 * @param req.query.override Whether to override files already downloaded (optional, defaults to false).
 * @param req.body Optional metadata to be sent through Webhook.
 * @return The status of network querying.
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
    const networkQueryIdentifier = {
      cxId,
      patientId,
      facilityId: patientFacilityId,
    };
    const queryProgressPromises: Array<Promise<SourceQueryProgress[]>> = [];
    for (const source of networkQuery.sources) {
      queryProgressPromises.push(
        queryDocumentsAcrossSource({
          ...networkQuery,
          ...networkQueryIdentifier,
          source,
        })
      );
    }

    const queryProgress = await Promise.all(queryProgressPromises);
    const networkQueryProgress = _.flatten(queryProgress);
    return res.status(OK).json(networkQueryProgress);
  })
);
