import { ehexOutboundPatientDiscoveryRespSchema } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/process/types";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { outboundDocumentQueryRespSchema } from "@metriport/ihe-gateway-sdk/models/document-query/document-query-responses";
import { outboundDocumentRetrievalRespSchema } from "@metriport/ihe-gateway-sdk/models/document-retrieval/document-retrieval-responses";
import { uuidv7 } from "@metriport/shared/util";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getFacilityByOidOrFail } from "../../../command/medical/facility/get-facility";
import { getOrganizationByOidOrFail } from "../../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getFacilityIdOrFail } from "../../../domain/medical/patient-facility";
import { listEhexDirectory } from "../../../external/ehex/command/directory/list-ehex-directory";
import { rebuildEhexDirectory } from "../../../external/ehex/command/directory/rebuild-ehex-directory";
import { getEhexOrgOrFail } from "../../../external/ehex/command/organization/get-organization";
import { processOutboundDqResps } from "../../../external/ehex/document/process-outbound-dq-resps";
import { processOutboundDrResps } from "../../../external/ehex/document/process-outbound-dr-resps";
import { getDocumentsFromEhex } from "../../../external/ehex/document/query-documents";
import { discover } from "../../../external/ehex/patient";
import { processOutboundPdResps } from "../../../external/ehex/patient/process-outbound-pd-resps";
import { Config } from "../../../shared/config";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import {
  asyncHandler,
  getFrom,
  getFromQueryAsBoolean,
  getFromQueryAsBooleanOrFail,
} from "../../util";

const router = Router();

/**
 * POST /internal/ehex/patient-discovery/response
 *
 * Receives a Patient Discovery response from the Ehex Gateway
 */
router.post(
  "/patient-discovery/response",
  // TODO ENG-1978 - remove this
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const response = ehexOutboundPatientDiscoveryRespSchema.parse(req.body);
    processOutboundPdResps(response).catch(processAsyncError("eHex PD response"));

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehex/document-query/response
 *
 * Receives a Document Query response from the Ehex Gateway
 */
router.post(
  "/document-query/response",
  // no requestLogger here because we get too many requests
  asyncHandler(async (req: Request, res: Response) => {
    const response = outboundDocumentQueryRespSchema.parse(req.body);
    processOutboundDqResps(response).catch(processAsyncError("eHex DQ response"));

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * POST /internal/ehex/document-retrieval/response
 *
 * Receives a Document Retrieval response from the Ehex Gateway
 */
router.post(
  "/document-retrieval/response",
  // no requestLogger here because we get too many requests
  asyncHandler(async (req: Request, res: Response) => {
    const response = outboundDocumentRetrievalRespSchema.parse(req.body);
    processOutboundDrResps(response).catch(processAsyncError("eHex DR response"));

    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehex/directory
 *
 * Retrieves organizations from the Ehex Directory.
 *
 * @param req.query.active Indicates whether to list active or inactive organizations.
 * @param req.query.oid Optional, the OID of the organization to fetch.
 * @param req.query.limit Optional, the number of organizations to fetch.
 * @param req.query.url The next URL to fetch the next page of organizations.
 * @returns Returns the organizations from the Ehex Directory.
 */
router.get(
  "/directory",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const active = getFromQueryAsBooleanOrFail("active", req);
    const oid = getFrom("query").optional("oid", req);
    const limitRaw = getFrom("query").optional("limit", req);
    const limit = limitRaw ? parseInt(limitRaw) : undefined;
    const orgs = await listEhexDirectory({
      oid,
      active,
      limit,
    });
    return res.status(httpStatus.OK).json({ amount: orgs.length, entries: orgs });
  })
);

/**
 * POST /internal/ehex/directory/rebuild
 *
 * Retrieves organizations from the Ehex Directory and uploads them into our database.
 */
router.post(
  "/directory/rebuild",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const failGracefully = getFromQueryAsBoolean("failGracefully", req) ?? false;
    await rebuildEhexDirectory({ failGracefully });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/ehex/ops/directory/organization/:oid
 *
 * Retrieves the organization with the specified OID from the Ehex Directory.
 * @param req.params.oid The OID of the organization to retrieve.
 * @returns Returns the organization with the specified OID.
 */
router.get(
  "/ops/directory/organization/:oid",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").optional("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);

    // Authorization
    if (facilityId) {
      await getFacilityByOidOrFail({ cxId, id: facilityId, oid });
    } else {
      await getOrganizationByOidOrFail({ cxId, oid });
    }
    const ehexOrg = await getEhexOrgOrFail(oid);

    return res.status(httpStatus.OK).json(ehexOrg);
  })
);

/**
 * POST /internal/ehex/patient-discovery/:id
 *
 * Triggers patient discovery for a specific patient in Ehex.
 * @param req.params.id The ID of the patient to run discovery for
 * @param req.query.cxId The customer ID.
 * @param req.query.requestId Optional request ID to use for the discovery
 * @param req.query.isScheduledDq Optional flag to indicate if this schedules a document query after patient discovery
 * @param req.query.forceDownload Optional flag to force document download
 * @param req.query.overrideIsTargetedQueryEnabled Optional flag to override the feature flag to use targeted queries.
 * @param req.query.overrideDemoAugEnabled Optional flag to override the cxsWithDemoAugEnabled FF. Defaults to the FF
 *                  value for the customer.
 * @param req.query.isUseAugmentedDemoOnFirstRun Optional flag to override the default behavior of using any
 *                  augmented demographics on the initial patient discovery. Defaults to false. See discover() in
 *                  {@link packages/api/src/external/ehex/patient.ts} for more details.
 * @returns 200 OK if discovery was triggered successfully
 */
router.post(
  "/patient-discovery/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);

    const patientId = getUUIDFrom("params", req, "id").orFail();
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityIdProvided = getUUIDFrom("query", req, "facilityId").optional();
    const requestId = getUUIDFrom("query", req, "requestId").optional() ?? uuidv7();
    const patient = await getPatientOrFail({ id: patientId, cxId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdProvided);
    const isScheduledDq = getFromQueryAsBoolean("isScheduledDq", req);
    const forceDownload = getFromQueryAsBoolean("forceDownload", req);
    const overrideIsTargetedQueryEnabled = getFromQueryAsBoolean(
      "overrideIsTargetedQueryEnabled",
      req
    );
    const overrideDemoAugEnabled = getFromQueryAsBoolean("overrideDemoAugEnabled", req);
    const isUseAugmentedDemoOnFirstRun = getFromQueryAsBoolean("isUseAugmentedDemoOnFirstRun", req);

    discover({
      patient,
      facilityId,
      rerunPdOnNewDemographics: overrideDemoAugEnabled,
      isUseAugmentedDemographics: isUseAugmentedDemoOnFirstRun,
      overrideIsTargetedQueryEnabled,
      ...(requestId ? { requestId } : {}),
      isScheduledDq,
      forceDownload,
    }).catch(processAsyncError("eHex discover"));
    return res.status(httpStatus.OK).json({ requestId });
  })
);

/**
 * POST /internal/ehex/document-query/:id
 *
 * Triggers document query for a specific patient in Ehex.
 * @param req.params.id The ID of the patient to run document query for
 * @param req.query.cxId The customer ID
 * @param req.query.forceDownload Optional flag to force document download
 * @param req.query.requestId Optional request ID to use for the document query
 * @returns 200 OK if document query was triggered successfully
 */
router.post(
  "/document-query/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);

    const patientId = getUUIDFrom("params", req, "id").orFail();
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityIdProvided = getUUIDFrom("query", req, "facilityId").optional();
    const requestId = getUUIDFrom("query", req, "requestId").optional() ?? uuidv7();
    const patient = await getPatientOrFail({ id: patientId, cxId });
    const facilityId = getFacilityIdOrFail(patient, facilityIdProvided);
    const forceDownload = getFromQueryAsBoolean("forceDownload", req) ?? false;

    getDocumentsFromEhex({
      patient,
      facilityId,
      requestId,
      forceDownload,
    }).catch(processAsyncError("eHex query"));
    return res.status(httpStatus.OK).json({ requestId });
  })
);

export default router;
