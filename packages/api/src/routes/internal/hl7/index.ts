import { BadRequestError } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { processHl7FhirBundleWebhook } from "../../../command/medical/patient/hl7-fhir-webhook";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import { asyncHandler } from "../../util";
import { hl7WebhookParamsSchema } from "./schemas";

const router = Router();

/**
 * POST /internal/hl7
 *
 * This is a webhook endpoint for sending HL7 FHIR bundles.
 *
 * @param req.query.patientId - UUID of the patient
 * @param req.query.cxId - UUID of the customer
 * @param req.query.presignedUrl - S3 presigned URL to access the FHIR bundle
 */
router.post(
  "/",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = getUUIDFrom("query", req, "patientId").orFail();
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const presignedUrl = req.query.presignedUrl;

    if (!presignedUrl || typeof presignedUrl !== "string") {
      throw new BadRequestError("presignedUrl is required in query parameters");
    }

    const { presignedUrl: validatedUrl } = hl7WebhookParamsSchema.parse({
      patientId,
      cxId,
      presignedUrl,
    });
    await processHl7FhirBundleWebhook({ cxId, patientId, presignedUrl: validatedUrl });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
