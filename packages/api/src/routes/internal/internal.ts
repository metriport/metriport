import { BadRequestError } from "@metriport/shared";
import { Request, Response, Router } from "express";
import httpStatus from "http-status";
import { getCxFFStatus } from "../../command/internal/get-hie-enabled-feature-flags-status";
import { updateCxHieEnabledFFs } from "../../command/internal/update-hie-enabled-feature-flags";
import {
  deleteCxMapping,
  findOrCreateCxMapping,
  getCxMappingsByCustomer,
  setExternalIdOnCxMapping,
} from "../../command/mapping/cx";
import {
  deleteFacilityMapping,
  findOrCreateFacilityMapping,
  getFacilityMappingsByCustomer,
  setExternalIdOnFacilityMapping,
} from "../../command/mapping/facility";
import { checkApiQuota } from "../../command/medical/admin/api";
import { dbMaintenance } from "../../command/medical/admin/db-maintenance";
import {
  PopulateFhirServerResponse,
  populateFhirServer,
} from "../../command/medical/admin/populate-fhir";
import { getFacilities, getFacilityOrFail } from "../../command/medical/facility/get-facility";
import {
  allowMapiAccess,
  hasMapiAccess,
  revokeMapiAccess,
} from "../../command/medical/mapi-access";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { isCxMappingSource, secondaryMappingsSchemaMap } from "../../domain/cx-mapping";
import { isFacilityMappingSource } from "../../domain/facility-mapping";
import { isEnhancedCoverageEnabledForCx } from "../../external/aws/app-config";
import { initCQOrgIncludeList } from "../../external/commonwell/organization";
import { OrganizationModel } from "../../models/medical/organization";
import userRoutes from "../devices/internal-user";
import { requestLogger } from "../helpers/request-logger";
import { internalDtoFromModel as facilityInternalDto } from "../medical/dtos/facilityDTO";
import { internalDtoFromModel as orgInternalDto } from "../medical/dtos/organizationDTO";
import carequalityRoutes from "../medical/internal-cq";
import commonwellRoutes from "../medical/internal-cw";
import docsRoutes from "../medical/internal-docs";
import facilityRoutes from "../medical/internal-facility";
import feedbackRoutes from "../medical/internal-feedback";
import hieRoutes from "../medical/internal-hie";
import mpiRoutes from "../medical/internal-mpi";
import organizationRoutes from "../medical/internal-organization";
import patientRoutes from "../medical/internal-patient";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean, getFromQueryOrFail } from "../util";

const router = Router();

router.use("/docs", docsRoutes);
router.use("/patient", patientRoutes);
router.use("/facility", facilityRoutes);
router.use("/organization", organizationRoutes);
router.use("/user", userRoutes);
router.use("/commonwell", commonwellRoutes);
router.use("/carequality", carequalityRoutes);
router.use("/mpi", mpiRoutes);
router.use("/hie", hieRoutes);
router.use("/feedback", feedbackRoutes);

/** ---------------------------------------------------------------------------
 * POST /internal/mapi-access
 *
 * Give access to MAPI for a (customer's) account. This is an idempotent
 * operation, which means it can be called multiple times without side effects.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @return 200/201 Indicating access has been given (201) or already had access (200).
 */
router.post(
  "/mapi-access",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const outcome = await allowMapiAccess(cxId);
    return res.sendStatus(outcome === "new" ? httpStatus.CREATED : httpStatus.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/mapi-access
 *
 * Returns a boolean indicating whether MAPI access has been provided for a customer.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @return payload Indicating access has been given (prop hasMapiAccess).
 */
router.get(
  "/mapi-access",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const hasMapi = await hasMapiAccess(cxId);
    return res.status(httpStatus.OK).json({ hasMapiAccess: hasMapi });
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /internal/mapi-access
 *
 * Revoke access to MAPI for a (customer's) account.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @return 204 When access revoked, 404 when access was not provided.
 */
router.delete(
  "/mapi-access",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    await revokeMapiAccess(cxId);
    return res.sendStatus(httpStatus.NO_CONTENT);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/populate-fhir-server
 *
 * Populate the FHIR server with customer's data.
 * This an idempotent endpoint, which means it can be called multiple times and it
 * will not have side effects.
 *
 * @deprecated Should no longer be used. Does not handle multiple hies.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.allCustomers - Whether we should populate all customers.
 * @param req.query.createIfNotExists - Creates the tenant on the FHIR server if
 *          it does not exist. (optional, default false)
 * @param req.query.triggerDocQuery - Triggers a new document query for each patient.
 *          (optional, default false)
 * @return 200 When successful, including the patient count.
 */
router.post(
  "/populate-fhir-server",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const allCustomers = getFrom("query").optional("allCustomers", req) === "true";
    const createIfNotExists = getFrom("query").optional("createIfNotExists", req) === "true";
    const triggerDocQuery = getFrom("query").optional("triggerDocQuery", req) === "true";

    if (cxId && allCustomers) {
      throw new BadRequestError("Either cxId or allCustomers must be provided, not both");
    }

    if (cxId) {
      const result = await populateFhirServer({ cxId, createIfNotExists, triggerDocQuery });
      return res.json({ [cxId]: result });
    }

    if (!allCustomers) {
      throw new BadRequestError("Either cxId or allCustomers must be provided, not both");
    }

    const allOrgs = await OrganizationModel.findAll();
    const result: Record<string, PopulateFhirServerResponse> = {};
    for (const org of allOrgs) {
      const orgRes = await populateFhirServer({
        cxId: org.cxId,
        createIfNotExists,
        triggerDocQuery,
      });
      result[org.cxId] = orgRes;
    }
    return res.json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/cq-include-list/reset
 *
 * Resets the CQ include list on CW for the given customer.
 */
router.post(
  "/cq-include-list/reset",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    if (!(await isEnhancedCoverageEnabledForCx(cxId))) {
      throw new BadRequestError("Enhanced Coverage is not enabled for this customer");
    }
    const orgOID = (await getOrganizationOrFail({ cxId })).oid;
    await initCQOrgIncludeList(orgOID);
    return res.sendStatus(httpStatus.OK);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/cx-data
 *
 * Returns the cx data used for internal scripts
 */
router.get(
  "/cx-data",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const org = await getOrganizationOrFail({ cxId });
    const facilities = await getFacilities({ cxId: org.cxId });

    const response = {
      cxId,
      org: orgInternalDto(org),
      facilities: facilities.map(f => facilityInternalDto(f)),
    };
    return res.status(httpStatus.OK).json(response);
  })
);

/** ---------------------------------------------------------------------------
 * GET /internal/check-api-quota
 *
 * Check API Gateway quota for each API Key and send a notification if it's below a threshold.
 */
router.post(
  "/check-api-quota",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxsWithLowQuota = await checkApiQuota();
    return res.status(httpStatus.OK).json({ cxsWithLowQuota });
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/db-maintenance
 *
 * Perform regular DB Maintenance.
 */
router.post(
  "/db-maintenance",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await dbMaintenance();
    console.log(`DB Maintenance Result: ${JSON.stringify(result)}`);
    return res.status(httpStatus.OK).json(result);
  })
);

/**
 * GET /internal/cx-ff-status
 *
 * Retrieves the customer status of enabled HIEs via the Feature Flags.
 *
 * @param req.query.cxId - The cutomer's ID.
 */
router.get(
  "/cx-ff-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const result = await getCxFFStatus(cxId);
    return res.status(httpStatus.OK).json(result);
  })
);

/**
 * PUT /internal/cx-ff-status
 *
 * Updates the customer status of enabled HIEs via the Feature Flags.
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.cwEnabled - Whether to enabled CommonWell.
 * @param req.query.cqEnabled - Whether to enabled CareQuality.
 * @param req.query.epicEnabled - Whether to enabled Epic.
 * @param req.query.demoAugEnabled - Whether to enabled Demo Aug.
 */
router.put(
  "/cx-ff-status",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const cwEnabled = getFromQueryAsBoolean("cwEnabled", req);
    const cqEnabled = getFromQueryAsBoolean("cqEnabled", req);
    const epicEnabled = getFromQueryAsBoolean("epicEnabled", req);
    const demoAugEnabled = getFromQueryAsBoolean("demoAugEnabled", req);
    const result = await updateCxHieEnabledFFs({
      cxId,
      cwEnabled,
      cqEnabled,
      epicEnabled,
      demoAugEnabled,
    });
    return res.status(httpStatus.OK).json(result);
  })
);

/**
 * POST /internal/cx-mapping
 *
 * Create cx mapping
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.source - Mapping source
 * @param req.query.externalId - Mapped external ID.
 */
router.post(
  "/cx-mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const source = getFromQueryOrFail("source", req);
    if (!isCxMappingSource(source)) {
      throw new BadRequestError(`Invalid source for cx mapping`, undefined, { source });
    }
    const externalId = getFromQueryOrFail("externalId", req);
    const secondaryMappingsSchema = secondaryMappingsSchemaMap[source];
    const secondaryMappings = secondaryMappingsSchema
      ? secondaryMappingsSchema.parse(req.body)
      : null;
    await findOrCreateCxMapping({
      cxId,
      source,
      externalId,
      secondaryMappings,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/cx-mapping
 *
 * Get cx mappings for customer
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.source - Optional mapping source
 */
router.get(
  "/cx-mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const source = getFrom("query").optional("source", req);
    if (source !== undefined && !isCxMappingSource(source)) {
      throw new BadRequestError(`Invalid source for cx mapping`, undefined, { source });
    }
    const result = await getCxMappingsByCustomer({
      cxId,
      ...(source && { source }),
    });
    return res.status(httpStatus.OK).json(result);
  })
);

/**
 * PUT /internal/cx-mapping/:id/external-id
 *
 * Update cx mapping external ID
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.externalId - Mapped external ID.
 */
router.put(
  "/cx-mapping/:id/external-id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFrom("params").orFail("id", req);
    const externalId = getFromQueryOrFail("externalId", req);
    await setExternalIdOnCxMapping({
      cxId,
      id,
      externalId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * DELETE /internal/cx-mapping/:id
 *
 * Delete cx mapping
 *
 * @param req.query.cxId - The cutomer's ID.
 */
router.delete(
  "/cx-mapping/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFrom("params").orFail("id", req);
    await deleteCxMapping({
      cxId,
      id,
    });
    return res.sendStatus(httpStatus.NO_CONTENT);
  })
);

/**
 * POST /internal/facility-mapping
 *
 * Create facility mapping
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.facilityId - The facility ID.
 * @param req.query.source - Mapping source
 * @param req.query.externalId - Mapped external ID.
 */
router.post(
  "/facility-mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getFromQueryOrFail("facilityId", req);
    await getFacilityOrFail({ cxId, id: facilityId });
    const source = getFromQueryOrFail("source", req);
    if (!isFacilityMappingSource(source)) {
      throw new BadRequestError(`Invalid source for facility mapping`, undefined, { source });
    }
    const externalId = getFromQueryOrFail("externalId", req);
    await findOrCreateFacilityMapping({
      cxId,
      facilityId,
      source,
      externalId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/facility-mapping
 *
 * Get facility mappings for customer
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.source - Optional mapping source
 */
router.get(
  "/facility-mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const source = getFrom("query").optional("source", req);
    if (source !== undefined && !isFacilityMappingSource(source)) {
      throw new BadRequestError(`Invalid source for facility mapping`, undefined, { source });
    }
    const result = await getFacilityMappingsByCustomer({
      cxId,
      ...(source && { source }),
    });
    return res.status(httpStatus.OK).json(result);
  })
);

/**
 * PUT /internal/facility-mapping/:id/external-id
 *
 * Update facility mapping external ID
 *
 * @param req.query.cxId - The cutomer's ID.
 * @param req.query.externalId - Mapped external ID.
 */
router.put(
  "/facility-mapping/:id/external-id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFrom("params").orFail("id", req);
    const externalId = getFromQueryOrFail("externalId", req);
    await setExternalIdOnFacilityMapping({
      cxId,
      id,
      externalId,
    });
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * DELETE /internal/facility-mapping/:id
 *
 * Delete facility mapping
 *
 * @param req.query.cxId - The cutomer's ID.
 */
router.delete(
  "/facility-mapping/:id",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFrom("params").orFail("id", req);
    await deleteFacilityMapping({
      cxId,
      id,
    });
    return res.sendStatus(httpStatus.NO_CONTENT);
  })
);

export default router;
