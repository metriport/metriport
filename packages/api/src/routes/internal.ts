import { Request, Response, Router } from "express";
import httpStatus from "http-status";
import { accountInit } from "../command/account-init";
import {
  PopulateFhirServerResponse,
  populateFhirServer,
} from "../command/medical/admin-populate-fhir";
import { allowMapiAccess, revokeMapiAccess } from "../command/medical/mapi-access";
import BadRequestError from "../errors/bad-request";
import { OrganizationModel } from "../models/medical/organization";
import docsRoutes from "./medical/internal-docs";
import patientRoutes from "./medical/internal-patient";
import userRoutes from "./devices/internal-user";
import { getUUIDFrom } from "./schemas/uuid";
import { asyncHandler, getCxIdFromQueryOrFail, getFrom } from "./util";
import { getOrganization } from "../command/medical/organization/get-organization";
import { getPatients } from "../command/medical/patient/get-patient";

const router = Router();

router.use("/docs", docsRoutes);
router.use("/patient", patientRoutes);
router.use("/user", userRoutes);

/** ---------------------------------------------------------------------------
 * POST /internal/init
 *
 * Initialize a (customer's) account. This is an idempotent operation, which
 * means it can be called multiple times without side effects.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @return 200 Indicating the account has been initialized.
 */
router.post(
  "/init",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdFromQueryOrFail(req);
    await accountInit(cxId);
    return res.sendStatus(httpStatus.OK);
  })
);

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
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.allCustomers - Whether we should populate all customers.
 * @param req.query.createIfNotExists - Creates the tenant on the FHIR server if
 *          it does not exist. (optional, default false)
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
 * POST /internal/doc-query-seed
 *
 * Upload test data to S3 and CW for testing doc queries.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.facilityId - The facility ID to add data too.
 * @return 200 Indicating the seed was successful.
 */
router.post(
  "/doc-query-seed",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const facilityId = getUUIDFrom("query", req, "facilityId").orFail();

    const org = await getOrganization({ cxId });

    const patients = await getPatients({ cxId, facilityId: facilityId });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
