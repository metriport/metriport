import { Organization } from "@metriport/core/domain/organization";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  isSuccessfulOutboundDocQueryResponse,
  isSuccessfulOutboundDocRetrievalResponse,
  outboundDocumentQueryRespSchema,
  outboundDocumentRetrievalRespSchema,
  outboundPatientDiscoveryRespSchema,
} from "@metriport/ihe-gateway-sdk";
import { BadRequestError, emptyFunction } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getFacilityByOidOrFail } from "../../../command/medical/facility/get-facility";
import {
  verifyCxAccessToSendFacilityToHies,
  verifyCxAccessToSendOrgToHies,
} from "../../../command/medical/facility/verify-access";
import {
  getOrganizationByOidOrFail,
  getOrganizationOrFail,
} from "../../../command/medical/organization/get-organization";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Facility } from "../../../domain/medical/facility";
import { listCQDirectory } from "../../../external/carequality/command/cq-directory/list-cq-directory";
import { rebuildCQDirectory } from "../../../external/carequality/command/cq-directory/rebuild-cq-directory";
import {
  DEFAULT_RADIUS_IN_MILES,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "../../../external/carequality/command/cq-directory/search-cq-directory";
import { getCqOrgOrFail } from "../../../external/carequality/command/cq-organization/get-cq-organization";
import { createOrUpdateFacility as cqCreateOrUpdateFacility } from "../../../external/carequality/command/create-or-update-facility";
import { createOrUpdateOrganization as cqCreateOrUpdateOrganization } from "../../../external/carequality/command/create-or-update-organization";
import { createOutboundDocumentQueryResp } from "../../../external/carequality/command/outbound-resp/create-outbound-document-query-resp";
import { createOutboundDocumentRetrievalResp } from "../../../external/carequality/command/outbound-resp/create-outbound-document-retrieval-resp";
import { createOutboundPatientDiscoveryResp } from "../../../external/carequality/command/outbound-resp/create-outbound-patient-discovery-resp";
import { processOutboundDocumentQueryResps } from "../../../external/carequality/document/process-outbound-document-query-resps";
import { processOutboundDocumentRetrievalResps } from "../../../external/carequality/document/process-outbound-document-retrieval-resps";
import {
  getDQResultStatus,
  getDRResultStatus,
  getPDResultStatus,
} from "../../../external/carequality/ihe-result";
import { processOutboundPatientDiscoveryResps } from "../../../external/carequality/process-outbound-patient-discovery-resps";
import { processPostRespOutboundPatientDiscoveryResps } from "../../../external/carequality/process-subsequent-outbound-patient-discovery-resps";
import { cqOrgActiveSchema } from "../../../external/carequality/shared";
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

dayjs.extend(duration);
const router = Router();

/**
 * GET /internal/carequality/directory
 *
 * Retrieves organizations from the Carequality Directory.
 *
 * @param req.query.active Indicates whether to list active or inactive organizations.
 * @param req.query.oid Optional, the OID of the organization to fetch.
 * @param req.query.limit Optional, the number of organizations to fetch.
 * @returns Returns the organizations from the Carequality Directory.
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
    const orgs = await listCQDirectory({
      oid,
      active,
      limit,
    });
    return res.status(httpStatus.OK).json({ amount: orgs.length, entries: orgs });
  })
);
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
    const failGracefully = getFromQueryAsBoolean("failGracefully", req);
    await rebuildCQDirectory(failGracefully);
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/carequality/ops/directory/organization/:oid
 *
 * Retrieves the organization with the specified OID from the Carequality Directory.
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
    const cqOrg = await getCqOrgOrFail(oid);
    // that's not used currently, so this makes the response smaller/faster and less dependent on
    // how we store data internally
    delete cqOrg.data;

    return res.status(httpStatus.OK).json(cqOrg);
  })
);

/**
 * @deprecated To be removed on #2586
 *
 * PUT /internal/carequality/ops/directory/organization/:oid
 *
 * Updates the organization in the Carequality Directory.
 */
router.put(
  "/ops/directory/organization/:oid",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const oid = getFrom("params").orFail("oid", req);
    const org = await getOrganizationByOidOrFail({ cxId, oid });
    if (!org.cqApproved) throw new BadRequestError("CQ not approved");
    await verifyCxAccessToSendOrgToHies(org);

    const orgActive = cqOrgActiveSchema.parse(req.body);
    const organizationUpdate: Organization = {
      ...org.dataValues,
      cqActive: orgActive.active,
    };
    const orgAtCq = await cqCreateOrUpdateOrganization({ org: organizationUpdate });
    // Separated from cqCreateOrUpdateOrganization() because that function is used in other
    // scenarios, and this endpoints is about to be removed on #2586.
    // Executed after the CQ update so we only mark as active if the CQ update is successful.
    await org.update({ cqActive: orgActive.active });

    return res.status(httpStatus.OK).json(orgAtCq);
  })
);

/**
 * @deprecated To be removed on #2586
 *
 * PUT /internal/carequality/ops/directory/facility/:oid
 *
 * Updates the facility in the Carequality Directory.
 * @param req.params.oid The OID of the facility to update.
 */
router.put(
  "/ops/directory/facility/:oid",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    if (Config.isSandbox()) return res.sendStatus(httpStatus.NOT_IMPLEMENTED);
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFrom("query").orFail("facilityId", req);
    const oid = getFrom("params").orFail("oid", req);
    const org = await getOrganizationOrFail({ cxId });
    await verifyCxAccessToSendFacilityToHies(org);

    const facility = await getFacilityByOidOrFail({ cxId, id: facilityId, oid });
    if (!facility.cqApproved) throw new BadRequestError("CQ not approved");

    const facilityActive = cqOrgActiveSchema.parse(req.body);
    const facilityUpdate: Facility = {
      ...facility.dataValues,
      cqActive: facilityActive.active,
    };
    const facilityAtCq = await cqCreateOrUpdateFacility({ org, facility: facilityUpdate });
    // Separated from cqCreateOrUpdateFacility() because that function is used in other
    // scenarios, and this endpoints is about to be removed on #2586.
    // Executed after the CQ update so we only mark as active if the CQ update is successful.
    await facility.update({ cqActive: facilityActive.active });

    return res.status(httpStatus.OK).json(facilityAtCq);
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

    response.duration = dayjs(response.responseTimestamp).diff(response.requestTimestamp);

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

    response.duration = dayjs(response.responseTimestamp).diff(response.requestTimestamp);

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

    response.duration = dayjs(response.responseTimestamp).diff(response.requestTimestamp);

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
