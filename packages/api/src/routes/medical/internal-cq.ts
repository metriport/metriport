import NotFoundError from "@metriport/core/util/error/not-found";
import {
  documentQueryRespFromExternalGWSchema,
  documentRetrievalRespFromExternalGWSchema,
  patientDiscoveryRespFromExternalGWSchema,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { makeCarequalityManagementAPI } from "../../external/carequality/api";
import { createOrUpdateCQOrganization } from "../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import { parseCQDirectoryEntries } from "../../external/carequality/command/cq-directory/parse-cq-directory-entry";
import { rebuildCQDirectory } from "../../external/carequality/command/cq-directory/rebuild-cq-directory";
import {
  DEFAULT_RADIUS_IN_MILES,
  searchCQDirectoriesAroundPatientAddresses,
} from "../../external/carequality/command/cq-directory/search-cq-directory";
import {
  IHEResultType,
  handleIHEResponse,
} from "../../external/carequality/command/ihe-result/create-ihe-result";
import { processDocumentQueryResults } from "../../external/carequality/document/process-document-query-results";
import { cqOrgDetailsSchema } from "../../external/carequality/shared";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";
import { asyncHandler, getFrom } from "../util";

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
 * Providing no body will use the env vars for the organization details.
 */
router.post(
  "/directory/organization",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;
    let orgDetails;
    if (body.oid) {
      orgDetails = cqOrgDetailsSchema.parse(body);
    } else {
      const orgDetailsString = Config.getCQOrgDetails();
      orgDetails = cqOrgDetailsSchema.parse(JSON.parse(orgDetailsString));
    }
    await createOrUpdateCQOrganization(orgDetails);

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
    const pdResponse = patientDiscoveryRespFromExternalGWSchema.parse(req.body);
    await handleIHEResponse({
      type: IHEResultType.PATIENT_DISCOVERY_RESP_FROM_EXTERNAL_GW,
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
    const dqResponse = documentQueryRespFromExternalGWSchema.parse(req.body);
    await handleIHEResponse({
      type: IHEResultType.DOCUMENT_QUERY_RESP_FROM_EXTERNAL_GW,
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
    await processDocumentQueryResults(req.body);

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
    const drResponse = documentRetrievalRespFromExternalGWSchema.parse(req.body);
    await handleIHEResponse({
      type: IHEResultType.DOCUMENT_RETRIEVAL_RESP_FROM_EXTERNAL_GW,
      response: drResponse,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
