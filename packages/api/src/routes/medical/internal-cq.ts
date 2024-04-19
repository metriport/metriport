import BadRequestError from "@metriport/core/util/error/bad-request";
import NotFoundError from "@metriport/core/util/error/not-found";
import { capture } from "@metriport/core/util/notifications";
import { initDbPool } from "@metriport/core/util/sequelize";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  isSuccessfulOutboundDocQueryResponse,
  isSuccessfulOutboundDocRetrievalResponse,
  outboundDocumentQueryRespSchema,
  outboundDocumentRetrievalRespSchema,
  outboundPatientDiscoveryRespSchema,
} from "@metriport/ihe-gateway-sdk";
import { emptyFunction } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { uniqBy } from "lodash";
import multer from "multer";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { makeCarequalityManagementAPI } from "../../external/carequality/api";
import { setEntriesAsGateway } from "../../external/carequality/command/cq-directory/cq-gateways";
import { bulkInsertCQDirectoryEntries } from "../../external/carequality/command/cq-directory/create-cq-directory-entry";
import { createOrUpdateCQOrganization } from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { parseCQDirectoryEntries } from "../../external/carequality/command/cq-directory/parse-cq-directory-entry";
import { rebuildCQDirectory } from "../../external/carequality/command/cq-directory/rebuild-cq-directory";
import {
  DEFAULT_RADIUS_IN_MILES,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "../../external/carequality/command/cq-directory/search-cq-directory";
import { cqDirectoryEntry } from "../../external/carequality/command/cq-directory/shared";
import { createOutboundDocumentQueryResp } from "../../external/carequality/command/outbound-resp/create-outbound-document-query-resp";
import { createOutboundDocumentRetrievalResp } from "../../external/carequality/command/outbound-resp/create-outbound-document-retrieval-resp";
import { createOutboundPatientDiscoveryResp } from "../../external/carequality/command/outbound-resp/create-outbound-patient-discovery-resp";
import { processOutboundDocumentQueryResps } from "../../external/carequality/document/process-outbound-document-query-resps";
import { processOutboundDocumentRetrievalResps } from "../../external/carequality/document/process-outbound-document-retrieval-resps";
import {
  getDQResultStatus,
  getDRResultStatus,
  getPDResultStatus,
} from "../../external/carequality/ihe-result";
import { processOutboundPatientDiscoveryResps } from "../../external/carequality/process-outbound-patient-discovery-resps";
import { processPostRespOutboundPatientDiscoveryResps } from "../../external/carequality/process-subsequent-outbound-patient-discovery-resps";
import { cqOrgDetailsSchema } from "../../external/carequality/shared";
import { Config } from "../../shared/config";
import { asyncHandler, getFrom, getFromQueryAsBoolean } from "../util";
import { requestLogger } from "../helpers/request-logger";

dayjs.extend(duration);
const router = Router();
const upload = multer();
const sequelize = initDbPool(Config.getDBCreds());

/**
 * POST /internal/carequality/directory/rebuild
 *
 * Retrieves organizations from the Carequality Directory and uploads them into our database.
 */
router.post(
  "/directory/rebuild",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    await rebuildCQDirectory();
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/carequality/directory/insert
 *
 * Inserts organizations from a Carequality Directory bundle into our database.
 * @param req.file The Carequality Directory to insert, in JSON format; it should include an array
 *    of Organization resources, property `Bundle.entry` from the original CQ directory payload.
 */
router.post(
  "/directory/insert",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError("File must be provided");
    }
    const bundle = JSON.parse(file.buffer.toString());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgs = bundle.map((e: any) => e.resource.Organization);
    console.log(`Got ${orgs.length} orgs`);

    const parsedOrgs = parseCQDirectoryEntries(orgs);
    console.log(`Parsed ${parsedOrgs.length} orgs`);

    const gatewaysSet = new Set<string>();
    for (const org of parsedOrgs) {
      if (org.managingOrganizationId) {
        gatewaysSet.add(org.managingOrganizationId);
      }
    }

    // TODO remove this with https://github.com/metriport/metriport-internal/issues/1638
    const nonDup = uniqBy(parsedOrgs, "id");
    console.log(`Adding ${nonDup.length} CQ directory entries...`);
    await bulkInsertCQDirectoryEntries(sequelize, nonDup, cqDirectoryEntry);

    await setEntriesAsGateway(Array.from(gatewaysSet));

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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cq = makeCarequalityManagementAPI();
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;
    const orgDetails = cqOrgDetailsSchema.parse(body);
    await createOrUpdateCQOrganization(orgDetails);

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/carequality/directory/nearby-organizations
 *
 * Retrieves the organizations with XCPD URLs within a specified radius from the patient's address.
 * @param req.query.cxId The ID of the customer organization.
 * @param req.query.patientId The ID of the patient.
 * @param req.query.radius Optional, the radius in miles within which to search for organizations. Defaults to 50 miles.
 *
 * @returns Returns the CQ organizations within a radius of the patient's address.
 */
router.get(
  "/directory/nearby-organizations",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    const patientId = getFrom("query").orFail("patientId", req);
    const radiusQuery = getFrom("query").optional("radius", req);
    const mustHaveXcpdLink = getFromQueryAsBoolean("mustHaveXcpdLink", req);
    const radius = radiusQuery ? parseInt(radiusQuery) : DEFAULT_RADIUS_IN_MILES;

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const orgs = await searchCQDirectoriesAroundPatientAddresses({
      patient,
      radiusInMiles: radius,
      mustHaveXcpdLink,
    });

    const orgsWithBasicDetails = orgs.map(toBasicOrgAttributes);
    return res.status(httpStatus.OK).json(orgsWithBasicDetails);
  })
);

// BELOW ARE THE ROUTES PERTAINING TO THE IHE-GATEWAY

/**
 * POST /internal/carequality/patient-discovery/response
 *
 * Receives a Patient Discovery response from the IHE Gateway
 */
router.post(
  "/patient-discovery/response",
  // no requestLogger here because we get too many requests
  asyncHandler(async (req: Request, res: Response) => {
    const response = outboundPatientDiscoveryRespSchema.parse(req.body);

    if (!response.patientId) {
      capture.message("Patient ID not found in patient discovery response", {
        extra: { context: "carequality.patient-discovery", response, level: "error" },
      });
    }

    const status = getPDResultStatus({ patientMatch: response.patientMatch });

    await createOutboundPatientDiscoveryResp({
      id: uuidv7(),
      requestId: response.id,
      patientId: response.patientId ?? "",
      status,
      response,
    });

    if (response.patientId && response.cxId) {
      processPostRespOutboundPatientDiscoveryResps({
        requestId: response.id,
        patientId: response.patientId,
        cxId: response.cxId,
      }).catch(emptyFunction);
    }

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/carequality/patient-discovery/results
 *
 * Receives Patient Discovery results from the patient discovery results lambda
 */
router.post(
  "/patient-discovery/results",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    // TODO validate the request with the Zod schema, its mostly based on outboundPatientDiscoveryRespSchema
    processOutboundPatientDiscoveryResps(req.body);

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
  // no requestLogger here because we get too many requests
  asyncHandler(async (req: Request, res: Response) => {
    const response = outboundDocumentQueryRespSchema.parse(req.body);

    if (!response.patientId) {
      capture.error("Patient ID not found in outbound DQ response", {
        extra: { context: "carequality.outbound.document-query", response },
      });
      throw new BadRequestError("Missing patientId");
    }

    let status = "failure";
    if (isSuccessfulOutboundDocQueryResponse(response)) {
      status = getDQResultStatus({
        docRefLength: response.documentReference?.length,
      });
    }

    await createOutboundDocumentQueryResp({
      id: uuidv7(),
      requestId: response.id,
      patientId: response.patientId,
      status,
      response,
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    // TODO validate the request with the Zod schema, its mostly based on outboundDocumentQueryRespSchema
    processOutboundDocumentQueryResps(req.body);

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
  // no requestLogger here because we get too many requests
  asyncHandler(async (req: Request, res: Response) => {
    const response = outboundDocumentRetrievalRespSchema.parse(req.body);

    if (!response.patientId) {
      capture.error("Patient ID not found in outbound DR response", {
        extra: { context: "carequality.outbound.document-retrieval", response },
      });
      throw new BadRequestError("Missing patientId");
    }

    let status = "failure";
    if (isSuccessfulOutboundDocRetrievalResponse(response)) {
      status = getDRResultStatus({
        docRefLength: response.documentReference?.length,
      });
    }

    await createOutboundDocumentRetrievalResp({
      id: uuidv7(),
      requestId: response.id,
      patientId: response.patientId,
      status,
      response,
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
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    // TODO validate the request with the Zod schema, its mostly based on outboundDocumentRetrievalRespSchema
    processOutboundDocumentRetrievalResps(req.body);

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
