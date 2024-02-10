import { Bundle, Resource } from "@medplum/fhirtypes";
import { getReferencesFromResources } from "@metriport/core/external/fhir/shared/bundle";
import { Request, Response, Router } from "express";
import httpStatus from "http-status";
import { checkApiQuota } from "../command/medical/admin/api";
import { dbMaintenance } from "../command/medical/admin/db-maintenance";
import {
  populateFhirServer,
  PopulateFhirServerResponse,
} from "../command/medical/admin/populate-fhir";
import { getFacilities } from "../command/medical/facility/get-facility";
import { allowMapiAccess, revokeMapiAccess } from "../command/medical/mapi-access";
import { getOrganizationOrFail } from "../command/medical/organization/get-organization";
import BadRequestError from "../errors/bad-request";
import { initCQOrgIncludeList } from "../external/commonwell/organization";
import { makeFhirApi } from "../external/fhir/api/api-factory";
import { countResources } from "../external/fhir/patient/count-resources";
import { getReferencesFromFHIR } from "../external/fhir/references/get-references";
import { OrganizationModel } from "../models/medical/organization";
import userRoutes from "./devices/internal-user";
import carequalityRoutes from "./medical/internal-cq";
import docsRoutes from "./medical/internal-docs";
import mpiRoutes from "./medical/internal-mpi";
import patientRoutes from "./medical/internal-patient";
import { getUUIDFrom } from "./schemas/uuid";
import { asyncHandler, getFrom } from "./util";

const router = Router();

router.use("/docs", docsRoutes);
router.use("/patient", patientRoutes);
router.use("/user", userRoutes);
router.use("/carequality", carequalityRoutes);
router.use("/mpi", mpiRoutes);

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
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const outcome = await allowMapiAccess(cxId);
    return res.sendStatus(outcome === "new" ? httpStatus.CREATED : httpStatus.OK);
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
 * GET /internal/count-fhir-resources
 *
 * Count all resources for this customer in the FHIR server.
 */
router.get(
  "/count-fhir-resources",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const result = await countResources({ patient: { cxId } });
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
  asyncHandler(async (req: Request, res: Response) => {
    const getOID = async (): Promise<string> => {
      const cxId = getUUIDFrom("query", req, "cxId").optional();
      if (cxId) return (await getOrganizationOrFail({ cxId })).oid;
      const orgOID = getFrom("query").optional("orgOID", req);
      if (orgOID) return orgOID;
      throw new BadRequestError(`Either cxId or orgOID must be provided`);
    };
    const orgOID = await getOID();
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
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const org = await getOrganizationOrFail({ cxId });

    const facilities = await getFacilities({ cxId: org.cxId });

    const response = {
      cxId: org.cxId,
      org: {
        id: org.id,
        oid: org.oid,
        name: org.data.name,
        type: org.data.type,
      },
      facilities: facilities.map(f => ({
        id: f.id,
        name: f.data.name,
        npi: f.data.npi,
        tin: f.data.tin,
        active: f.data.active,
      })),
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
  asyncHandler(async (req: Request, res: Response) => {
    const result = await dbMaintenance();
    console.log(`DB Maintenance Result: ${JSON.stringify(result)}`);
    return res.status(httpStatus.OK).json(result);
  })
);

/**
 * TODO Remove or repurpose this after tests are done.
 *
 * Built for testing purposes
 */
router.post(
  "/references-from-fhir",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();

    const bundle = req.body as Bundle<Resource>;
    const resources = (bundle.entry ?? []).flatMap(e => e.resource ?? []);

    const fhir = makeFhirApi(cxId);
    const { missingReferences } = getReferencesFromResources({ resources });

    const result = await getReferencesFromFHIR(missingReferences, fhir, console.log);

    return res.status(httpStatus.OK).json(result);
  })
);

export default router;
