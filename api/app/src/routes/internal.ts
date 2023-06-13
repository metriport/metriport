import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { accountInit } from "../command/account-init";
import {
  populateFhirServer,
  PopulateFhirServerResponse,
} from "../command/medical/admin-populate-fhir";
import { reprocessDocuments } from "../command/medical/document/document-redownload";
import { allowMapiAccess, revokeMapiAccess } from "../command/medical/mapi-access";
import BadRequestError from "../errors/bad-request";
import { OrganizationModel } from "../models/medical/organization";
import { encodeExternalId } from "../shared/external";
import { capture } from "../shared/notifications";
import { stringToBoolean } from "../shared/types";
import { stringListSchema } from "./schemas/shared";
import { getUUIDFrom } from "./schemas/uuid";
import {
  getETag,
  asyncHandler,
  getCxIdFromQueryOrFail,
  getFrom,
  getCxIdOrFail,
  getFromParamsOrFail,
  getFromQueryOrFail,
} from "./util";
import { deletePatient } from "../command/medical/patient/delete-patient";
import { updateDocQuery } from "../command/medical/document/document-query";
import { convertResultSchema } from "../domain/medical/document-reference";
import { Util } from "../shared/util";

const router = Router();

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

    if (cxId && allCustomers) {
      throw new BadRequestError("Either cxId or allCustomers must be provided, not both");
    }

    if (cxId) {
      const result = await populateFhirServer({ cxId, createIfNotExists });
      return res.json({ [cxId]: result });
    }

    if (!allCustomers) {
      throw new BadRequestError("Either cxId or allCustomers must be provided, not both");
    }

    const allOrgs = await OrganizationModel.findAll();
    const result: Record<string, PopulateFhirServerResponse> = {};
    for (const org of allOrgs) {
      const orgRes = await populateFhirServer({ cxId: org.cxId, createIfNotExists });
      result[org.cxId] = orgRes;
    }
    return res.json(result);
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/docs/reprocess
 *
 * Use the document reference we have on FHIR server to:
 * - re-download the Binary and update it on S3 (if override = true);
 * - re-convert it to FHIR (when applicable);
 * - update the FHIR server with the results.
 *
 * Assumes document references it gets from the FHIR server were inserted with their IDs
 * encoded. See usages of `getDocumentPrimaryId()` on `document-query.ts`.
 *
 * Asychronous operation, returns 200 immediately.
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.documentIds - Optional comma-separated list of document IDs to
 *     re-download; if not set all documents of the customer will be re-downloaded.
 * @param req.query.override - Optional, defines whether we should re-download the
 *     documents from CommonWell, defaults to false.
 * @return 200
 */
router.post(
  "/docs/reprocess",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const documentIdsRaw = getFrom("query").optional("documentIds", req);
    const documentIds = documentIdsRaw
      ? stringListSchema.parse(documentIdsRaw.split(",").map(id => id.trim()))
      : [];
    const override = stringToBoolean(getFrom("query").optional("override", req));

    reprocessDocuments({ cxId, documentIds, override }).catch(err => {
      console.log(`Error re-processing documents for cxId ${cxId}: `, err);
      capture.error(err);
    });
    return res.json({ processing: true });
  })
);

/** ---------------------------------------------------------------------------
 * POST /internal/docs/encode-ids
 *
 * Encode the document IDs using the same logic used to send docs to the FHIR server.
 *
 * @param req.query.documentIds - The comma-separated list of document IDs to re-download.
 * @return 200
 */
router.post(
  "/docs/encode-ids",
  asyncHandler(async (req: Request, res: Response) => {
    const documentIdsRaw = getFrom("query").optional("documentIds", req);
    const documentIds = documentIdsRaw
      ? stringListSchema.parse(documentIdsRaw.split(",").map(id => id.trim()))
      : [];
    const result: Record<string, string> = {};
    documentIds.forEach(id => {
      result[id] = encodeExternalId(id);
    });
    return res.json(result);
  })
);

/** ---------------------------------------------------------------------------
 * DELETE /patient/:id
 *
 * Deletes a patient from all storages.
 *
 * @param req.query.facilityId The facility providing NPI for the patient delete
 * @return 204 No Content
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const id = getFromParamsOrFail("id", req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const patientDeleteCmd = {
      ...getETag(req),
      id,
      cxId,
      facilityId,
    };
    await deletePatient(patientDeleteCmd);

    return res.sendStatus(httpStatus.NO_CONTENT);
  })
);

router.post(
  "/doc-conversion-status",
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getFrom("params").orFail("patientId", req);
    const cxId = getUUIDFrom("params", req, "cxId").orFail();
    const status = getFrom("params").orFail("status", req);
    const docId = getFrom("params").orFail("jobId", req);
    const convertResult = convertResultSchema.parse(status);
    const { log } = Util.out(`Doc conversion status`);

    log(`Converted document ${docId} for patient ${patientId} with status ${status}`);

    await updateDocQuery({
      patient: { id: patientId, cxId },
      convertResult,
    });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
