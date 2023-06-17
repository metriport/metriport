import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { z } from "zod";
import {
  isDocumentQueryProgressEqual,
  updateDocQuery,
} from "../../command/medical/document/document-query";
import { reprocessDocuments } from "../../command/medical/document/document-redownload";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { MAPIWebhookStatus, MAPIWebhookType, processPatientDocumentRequest } from "../../command/webhook/medical";
import { convertResult } from "../../domain/medical/document-reference";
import BadRequestError from "../../errors/bad-request";
import { encodeExternalId } from "../../shared/external";
import { capture } from "../../shared/notifications";
import { stringToBoolean } from "../../shared/types";
import { Util } from "../../shared/util";
import { documentQueryProgressSchema } from "../schemas/internal";
import { stringListSchema } from "../schemas/shared";
import { getUUIDFrom } from "../schemas/uuid";
import { asyncHandler, getFrom } from "../util";

const router = Router();

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
  "/reprocess",
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
  "/encode-ids",
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

const convertResultSchema = z.enum(convertResult);
export async function conversionStatus(req: Request, res: Response) {
  const patientId = getFrom("query").orFail("patientId", req);
  const cxId = getUUIDFrom("query", req, "cxId").orFail();
  const status = getFrom("query").orFail("status", req);
  const docId = getFrom("query").optional("jobId", req);
  const convertResult = convertResultSchema.parse(status);
  const { log } = Util.out(`Doc conversion status - patient ${patientId}`);

  log(`Converted document ${docId} with status ${convertResult}`);

  // START TODO 785 remove this once we're confident with the flow
  const patientPre = await getPatientOrFail({ id: patientId, cxId });
  log(`Status pre-update: ${JSON.stringify(patientPre.data.documentQueryProgress)}`);
  // END TODO 785

  let expectedPatient = await updateDocQuery({
    patient: { id: patientId, cxId },
    convertResult,
  });

  // START TODO 785 remove this once we're confident with the flow
  const maxAttempts = 3;
  let curAttempt = 1;
  let verifiedSuccess = false;
  while (curAttempt++ < maxAttempts) {
    const patientPost = await getPatientOrFail({ id: patientId, cxId });
    log(
      `[attempt ${curAttempt}] Status post-update: ${JSON.stringify(
        patientPost.data.documentQueryProgress
      )}`
    );
    if (
      !isDocumentQueryProgressEqual(
        expectedPatient.data.documentQueryProgress,
        patientPost.data.documentQueryProgress
      )
    ) {
      log(`[attempt ${curAttempt}] Status post-update not expected... trying to update again`);
      expectedPatient = await updateDocQuery({
        patient: { id: patientId, cxId },
        convertResult,
      });
    } else {
      log(`[attempt ${curAttempt}] Status post-update is as expected!`);
      verifiedSuccess = true;
      break;
    }
  }
  if (!verifiedSuccess) {
    const patientPost = await getPatientOrFail({ id: patientId, cxId });
    log(`final Status post-update: ${JSON.stringify(patientPost.data.documentQueryProgress)}`);
  }
  // END TODO 785

  const conversionStatus = expectedPatient.data.documentQueryProgress?.convert?.status;
  if (conversionStatus === "completed") {
    processPatientDocumentRequest(
      cxId,
      patientId,
      MAPIWebhookType.documentConversion,
      MAPIWebhookStatus.completed
    );
  }

  return res.sendStatus(httpStatus.OK);
}
router.post(
  "/conversion-status",
  asyncHandler(async (req: Request, res: Response) => {
    return conversionStatus(req, res);
  })
);

router.post(
  "/override-progress",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientId = getFrom("query").orFail("patientId", req);
    const docQueryProgressRaw = req.body;
    const docQueryProgress = documentQueryProgressSchema.parse(docQueryProgressRaw);
    const downloadProgress = docQueryProgress.download;
    const convertProgress = docQueryProgress.convert;
    if (!downloadProgress && !convertProgress) {
      throw new BadRequestError(`Require at least one of 'download' or 'convert'`);
    }
    const patient = await getPatientOrFail({ cxId, id: patientId });
    console.log(
      `Updating patient ${patientId}'s docQueryProgress ` +
        `from ${JSON.stringify(patient.data.documentQueryProgress)} ` +
        `to ${JSON.stringify(docQueryProgress)}`
    );
    const updatedPatient = await updateDocQuery({
      patient: { id: patientId, cxId },
      downloadProgress,
      convertProgress,
    });

    return res.json(updatedPatient.data.documentQueryProgress);
  })
);

router.post(
  "/check-conversions",
  asyncHandler(async (req: Request, res: Response) => {
    // TODO 798 Implement this
    return res.sendStatus(200);
  })
);

export default router;
