import { stringToBoolean } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { OK } from "http-status";
import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { queryDocumentsAcrossPharmacies } from "../../command/medical/network/pharmacy-query";
import { requestLogger } from "../helpers/request-logger";
import { getPatientInfoOrFail, patientAuthorization } from "../middlewares/patient-authorization";
import { checkRateLimit } from "../middlewares/rate-limiting";
import { asyncHandler, getFrom } from "../util";
import { cxRequestMetadataSchema } from "./schemas/request-metadata";
import { getPatientPrimaryFacilityIdOrFail } from "../../command/medical/patient/get-patient-facilities";

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
    const override = stringToBoolean(getFrom("query").optional("override", req));
    const cxDocumentRequestMetadata = cxRequestMetadataSchema.parse(req.body);
    const queryPharmacies = stringToBoolean(getFrom("query").optional("pharmacies", req));
    const forceCommonwell = stringToBoolean(getFrom("query").optional("commonwell", req));
    const forceCarequality = stringToBoolean(getFrom("query").optional("carequality", req));

    // TODO ENG-618: Temporary fix until we make facilityId required in the API
    const patientFacilityId = facilityId
      ? facilityId
      : await getPatientPrimaryFacilityIdOrFail({ cxId, patientId });

    const [docQueryProgress] = await Promise.all([
      queryDocumentsAcrossHIEs({
        cxId,
        patientId,
        facilityId: patientFacilityId,
        forceDownload: override,
        cxDocumentRequestMetadata: cxDocumentRequestMetadata?.metadata,
        forceCommonwell,
        forceCarequality,
      }),
      queryPharmacies
        ? queryDocumentsAcrossPharmacies({
            cxId,
            patientId,
            facilityId: patientFacilityId,
          }).catch(() => {
            return undefined;
          })
        : Promise.resolve(undefined),
    ]);

    return res.status(OK).json(docQueryProgress);
  })
);
