import { BadRequestError, EhrSources } from "@metriport/shared";
import { Request, Response, Router } from "express";
import httpStatus from "http-status";
import { getCxFFStatus } from "../../command/internal/get-hie-enabled-feature-flags-status";
import { updateCxHieEnabledFFs } from "../../command/internal/update-hie-enabled-feature-flags";
import {
  deleteCxMapping,
  findOrCreateCxMapping,
  getCxMappingsByCustomer,
  setExternalIdOnCxMappingById,
  setSecondaryMappingsOnCxMappingById,
} from "../../command/mapping/cx";
import {
  deleteFacilityMapping,
  findOrCreateFacilityMapping,
  getFacilityMappingsByCustomer,
  setExternalIdOnFacilityMapping,
} from "../../command/mapping/facility";
import { checkApiQuota } from "../../command/medical/admin/api";
import { dbMaintenance } from "../../command/medical/admin/db-maintenance";
import { getFacilities, getFacilityOrFail } from "../../command/medical/facility/get-facility";
import {
  allowMapiAccess,
  hasMapiAccess,
  revokeMapiAccess,
} from "../../command/medical/mapi-access";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import {
  CxMappingSource,
  isCxMappingSource,
  secondaryMappingsSchemaMap,
} from "../../domain/cx-mapping";
import { isFacilityMappingSource } from "../../domain/facility-mapping";
import { subscribeToAllWebhooks as subscribeToElationWebhooks } from "../../external/ehr/elation/command/subscribe-to-webhook";
import { subscribeToAllWebhooks as subscribeToHealthieWebhooks } from "../../external/ehr/healthie/command/subscribe-to-webhook";
import userRoutes from "../devices/internal-user";
import { requestLogger } from "../helpers/request-logger";
import { internalDtoFromModel as facilityInternalDto } from "../medical/dtos/facilityDTO";
import { internalDtoFromModel as orgInternalDto } from "../medical/dtos/organizationDTO";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom, getFromQueryAsBoolean, getFromQueryOrFail } from "../util";
import analyticsPlatformRoutes from "./analytics-platform";
import ehr from "./ehr";
import hieRoutes from "./hie";
import carequalityRoutes from "./hie/carequality";
import commonwellRoutes from "./hie/commonwell";
import questRoutes from "./integration/quest";
import jwtToken from "./jwt-token";
import docsRoutes from "./medical/docs";
import facilityRoutes from "./medical/facility";
import ffsRoutes from "./medical/feature-flags";
import feedbackRoutes from "./medical/feedback";
import mpiRoutes from "./medical/mpi";
import organizationRoutes from "./medical/organization";
import patientRoutes from "./medical/patient";
import tcmEncounter from "./medical/tcm-encounter";

const router = Router();

router.use("/feature-flags", ffsRoutes);
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
router.use("/token", jwtToken);
router.use("/ehr", ehr);
router.use("/tcm/encounter", tcmEncounter);
router.use("/analytics-platform", analyticsPlatformRoutes);
router.use("/quest", questRoutes);

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
 * @deprecated move this to the /feature-flags route
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
 * @deprecated move this to the /feature-flags route
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
    if (source === EhrSources.elation) {
      await subscribeToElationWebhooks({ cxId, externalId });
    } else if (source === EhrSources.healthie) {
      await subscribeToHealthieWebhooks({ cxId, externalId });
    }
    return res.sendStatus(httpStatus.OK);
  })
);

/**
 * GET /internal/cx-mapping
 *
 * Get cx mappings for customer.
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
    await setExternalIdOnCxMappingById({
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
 * PUT /internal/cx-mapping/:id/secondary-mapping
 *
 * Update secondary mapping in a cx mapping.
 *
 * @param req.query.cxId - The customer's ID.
 * @param req.parmas.id - The cx mapping ID.
 * @param req.query.source - the mapping source.
 *
 * @return status 200 with the newly updated CxMapping object.
 */
router.put(
  "/cx-mapping/:id/secondary-mapping",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const id = getFrom("params").orFail("id", req);
    const source = getFromQueryOrFail("source", req);
    const secondaryMappingsSchema = secondaryMappingsSchemaMap[source as CxMappingSource];
    const secondaryMappings = secondaryMappingsSchema
      ? secondaryMappingsSchema.parse(req.body)
      : undefined;
    if (!secondaryMappings) {
      throw new BadRequestError(`Invalid secondaryMappings for cx mapping`, undefined, {
        cxId,
        id,
        source,
        secondaryMappings,
      });
    }
    const newCxMapping = await setSecondaryMappingsOnCxMappingById({
      cxId,
      id,
      secondaryMappings,
    });
    return res.status(httpStatus.OK).json({ cxMapping: newCxMapping });
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
