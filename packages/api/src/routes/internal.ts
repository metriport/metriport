import { Request, Response, Router } from "express";
import httpStatus from "http-status";
import multer from "multer";
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
import { getUUIDFrom } from "./schemas/uuid";
import { asyncHandler, getCxIdFromQueryOrFail, getFrom } from "./util";
import { makeS3Client } from "../external/aws/s3";
import { getPatientOrFail } from "../command/medical/patient/get-patient";
import { makeFhirApi } from "../external/fhir/api/api-factory";
import { getOrganizationOrFail } from "../command/medical/organization/get-organization";
import { Config } from "../shared/config";

const router = Router();
const upload = multer();
const s3client = makeS3Client();
const bucketName = Config.getMedicalDocumentsBucketName();

router.use("/docs", docsRoutes);
router.use("/patient", patientRoutes);

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
        cxId: organization.cxId,
        createIfNotExists,
        triggerDocQuery,
      });
      result[organization.cxId] = orgRes;
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
 * @return 200 Indicating the file was successfully uploaded.
 */
router.post(
  "/upload-doc",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").optional();
    const patientId = getUUIDFrom("query", req, "patientId").optional();

    const file = req.file;

    if (!file) {
      throw new BadRequestError("File must be provided");
    }

    if (!cxId) {
      throw new BadRequestError("cxId must be provided");
    }

    if (!patientId) {
      throw new BadRequestError("patientId must be provided");
    }

    const organization = await getOrganizationOrFail({ cxId });
    const patient = await getPatientOrFail({ id: patientId, cxId });

    console.log(patient);

    const uploaded = await s3client
      .upload({
        Bucket: bucketName,
        Key: file.fieldname,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    const fhirApi = makeFhirApi(cxId);

    const description = req.body.description;

    const data = `{
        "resourceType": "DocumentReference",
        "id": "${docRefId}",
        "contained": [
            {
                "resourceType": "Organization",
                "id": "${organization.id}",
                "name": "${organization.name}"
            },
            {
                "resourceType": "Patient",
                "id": "${patientId}"
            }
        ],
        "masterIdentifier": {
            "system": "urn:ietf:rfc:3986",
            "value": "${docRefId}"
        },
        "identifier": [
            {
                "use": "official",
                "system": "urn:ietf:rfc:3986",
                "value": "${docRefId}"
            }
        ],
        "status": "current",
        "type": {
          "coding": [
              {
                  "system": "http://loinc.org/",
                  "code": "75622-1",
                  "display":  "${description}"
              }
          ]
        },
        "subject": {
            "reference": "Patient/${patientId}",
            "type": "Patient"
        },
        "author": [
            {
                "reference": "#${organization.id}",
                "type": "Organization"
            }
        ],
        "description": "${description}",
        "content": [
            {
                "attachment": {
                    "contentType": "${obj.ContentType}",
                    "url": "${docUrl}?fileName=${doc.fileName}"
                }
            }
        ],
        "context": {
          "period": {
              "start": "2022-10-05T22:00:00.000Z",
              "end": "2022-10-05T23:00:00.000Z"
          },
          "sourcePatientInfo": {
              "reference": "#${patientId}",
              "type": "Patient"
          }
      }
    }`;

    //   await fhirApi.put(`/DocumentReference/${docRefId}`, JSON.parse(data));

    // console.log(req.body.test);
    // console.log(uploaded);
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
