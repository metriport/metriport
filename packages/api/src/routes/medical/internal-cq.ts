import NotFoundError from "@metriport/core/util/error/not-found";
import {
  outboundPatientDiscoveryRespSchema,
  outboundDocumentQueryRespSchema,
  outboundDocumentRetrievalRespSchema,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { makeCarequalityAPI } from "../../external/carequality/api";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { parseCQDirectoryEntries } from "../../external/carequality/command/cq-directory/parse-cq-directory-entry";
import { rebuildCQDirectory } from "../../external/carequality/command/cq-directory/rebuild-cq-directory";
import {
  DEFAULT_RADIUS_IN_MILES,
  searchCQDirectoriesAroundPatientAddresses,
} from "../../external/carequality/command/cq-directory/search-cq-directory";
import {
  OutboundRespType,
  handleOutboundResponse,
} from "../../external/carequality/command/outbound-resp/create-outbound-resp";
import { createOrUpdateCQOrganization } from "../../external/carequality/organization";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";
import { asyncHandler, getFrom } from "../util";
import { processOutboundDocumentQueryResps } from "../../external/carequality/document/process-outbound-document-query-resps";
import { processOutboundDocumentRetrievalResps } from "../../external/carequality/document/process-outbound-document-retrieval-resps";

dayjs.extend(duration);
const router = Router();

/**
 * POST /internal/carequality/directory/rebuild
 *
 * Retrieves organizations from the Carequality Directory and uploads them into our database.
 */
router.post(
  "/directory/rebuild",
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    await rebuildCQDirectory();
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/carequality/directory/organization/:oid
 *
 * Retrieves the organization with the specified OID from the Carequality Directory.
 * @param req.params.oid The OID of the organization to retrieve.
 * @returns Returns the organization with the specified OID.
 */
router.get(
  "/directory/organization/:oid",
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cq = makeCarequalityAPI();
    if (!cq) throw new Error("Carequality API not initialized");
    const oid = getFrom("params").orFail("oid", req);
    const resp = await cq.listOrganizations({ count: 1, oid });
    const org = parseCQDirectoryEntries(resp);

    if (org.length > 1) {
      const msg = "More than one organization with the same OID found in the CQ directory";
      console.log(msg, oid);
      capture.message(msg, {
        extra: { context: `carequality.directory`, oid, organizations: org, level: "info" },
      });
    }

    const matchingOrg = org[0];
    if (!matchingOrg) throw new NotFoundError("Organization not found");

    return res.status(httpStatus.OK).json(matchingOrg);
  })
);

/**
 * POST /internal/carequality/directory/organization
 *
 * Creates or updates the organization in the Carequality Directory.
 */
router.post(
  "/directory/organization",
  asyncHandler(async (req: Request, res: Response) => {
    await createOrUpdateCQOrganization();
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/carequality/directory/nearby-organizations
 *
 * Retrieves the organizations within a specified radius from the patient's address.
 * @param req.query.cxId The ID of the customer organization.
 * @param req.query.patientId The ID of the patient.
 * @param req.query.radius Optional, the radius in miles within which to search for organizations. Defaults to 50 miles.
 *
 * @returns Returns the CQ organizations within a radius of the patient's address.
 */
router.get(
  "/directory/nearby-organizations",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const radiusQuery = getFrom("query").optional("radius", req);
    const radius = radiusQuery ? parseInt(radiusQuery) : DEFAULT_RADIUS_IN_MILES;

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const orgs = await searchCQDirectoriesAroundPatientAddresses({
      patient,
      radiusInMiles: radius,
    });

    return res.status(httpStatus.OK).json(orgs);
  })
);

// BELOW ARE THE ROUTES PERTAINING TO THE IHE-GATEWAY

/**
 * POST /internal/carequality/patient-discovery/response/response
 *
 * Receives a Patient Discovery response from the IHE Gateway
 */
router.post(
  "/patient-discovery/response",
  asyncHandler(async (req: Request, res: Response) => {
    const pdResponse = outboundPatientDiscoveryRespSchema.parse(req.body);
    await handleOutboundResponse({
      type: OutboundRespType.OUTBOUND_PATIENT_DISCOVERY_RESP,
      response: pdResponse,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/carequality/document-query/response
 *
 * Receives a Document Query response from the IHE Gateway
 */
router.post(
  "/document-query/response",
  asyncHandler(async (req: Request, res: Response) => {
    const dqResponse = outboundDocumentQueryRespSchema.parse(req.body);
    await handleOutboundResponse({
      type: OutboundRespType.OUTBOUND_DOCUMENT_QUERY_RESP,
      response: dqResponse,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/carequality/document-query/results
 *
 * Receives Document Query results from the doc query results lambda
 */
router.post(
  "/document-query/results",
  asyncHandler(async (req: Request, res: Response) => {
    await processOutboundDocumentQueryResps(req.body);

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/carequality/document-retrieval/response
 *
 * Receives a Document Retrieval response from the IHE Gateway
 */
router.post(
  "/document-retrieval/response",
  asyncHandler(async (req: Request, res: Response) => {
    const drResponse = outboundDocumentRetrievalRespSchema.parse(req.body);
    await handleOutboundResponse({
      type: OutboundRespType.OUTBOUND_DOCUMENT_RETRIEVAL_RESP,
      response: drResponse,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/carequality/document-retrieval/results
 *
 * Receives Document Retrieval results from the doc retrieval results lambda
 */
router.post(
  "/document-retrieval/results",
  asyncHandler(async (req: Request, res: Response) => {
    await processOutboundDocumentRetrievalResps(req.body);

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
