import { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import httpStatus from "http-status";
import multer from "multer";
import { accountInit } from "../command/account-init";
import {
  PopulateFhirServerResponse,
  populateFhirServer,
} from "../command/medical/admin/populate-fhir";
import { allowMapiAccess, revokeMapiAccess } from "../command/medical/mapi-access";
import BadRequestError from "../errors/bad-request";
import { OrganizationModel } from "../models/medical/organization";
import docsRoutes from "./medical/internal-docs";
import patientRoutes from "./medical/internal-patient";
import userRoutes from "./devices/internal-user";
import { getUUIDFrom } from "./schemas/uuid";
import { asyncHandler, getCxIdFromQueryOrFail, getFrom, getFromQueryOrFail } from "./util";
import { makeS3Client } from "../external/aws/s3";
import { Config } from "../shared/config";
import { createAndUploadDocReference } from "../command/medical/admin/upload-doc";
import { createS3FileName } from "../shared/external";

const router = Router();
const upload = multer();
const s3client = makeS3Client();
const bucketName = Config.getMedicalDocumentsBucketName();

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
 * POST /internal/upload-doc
 *
 * Upload doc for a patient
 *
 * @param req.query.cxId - The customer/account's ID.
 * @param req.query.patientId - The patient ID.
 * @param req.file - The file to be stored.
 * @param req.body.metadata - The metadata for the file.

 * @return 200 Indicating the file was successfully uploaded.
 */
router.post(
  "/upload-doc",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFromQueryOrFail("patientId", req);
    const file = req.file;

    if (!file) {
      throw new BadRequestError("File must be provided");
    }

    const docRefId = uuidv4();
    const fileName = createS3FileName(cxId, patientId, docRefId);

    await s3client
      .upload({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    const metadata = JSON.parse(req.body.metadata);

    const docRef = await createAndUploadDocReference({
      cxId,
      patientId,
      docId: docRefId,
      file: {
        ...file,
        originalname: fileName,
      },
      metadata,
    });

    return res.status(httpStatus.OK).json(docRef);
  })
);

export default router;
