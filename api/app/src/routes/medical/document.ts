import { Request, Response } from "express";
import Router from "express-promise-router";
import * as AWS from "aws-sdk";
import status from "http-status";
import { processAsyncError } from "../../errors";
import { getDocuments as getDocumentsFromCW } from "../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../external/commonwell/patient-shared";
import { getDocuments } from "../../external/fhir/document/get-documents";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { asyncHandler, getCxIdOrFail, getFromQuery, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";

const router = Router();

// NEED TO UPDATE THIS
const s3client = new AWS.S3({
  region: "us-east-2",
  accessKeyId: "***************",
  secretAccessKey: "***************",
});

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Queries for all available document metadata for the specified patient across HIEs.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document query.
 * @return The metadata of available documents.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);

    const patient = await getPatientOrFail({ id: patientId, cxId });
    let queryStatus = patient.data.documentQueryStatus;

    const documents = await getDocuments(patientId);

    const documentsDTO = toDTO(documents);

    // TODO: #515 We should only query on certain situations, when patient is created and/or updated.
    // This is temporary and makes the current solution extensible for that ^.
    if (queryStatus !== "processing") {
      getDocumentsFromCW({ patient, facilityId }).catch(processAsyncError(`getDocumentsFromCW`));
      // Temporary solution
      // only override the status if we have CW IDs
      const externalData = patient.data.externalData?.COMMONWELL;
      if (externalData) {
        const cwData = externalData as PatientDataCommonwell;
        if (cwData.patientId) queryStatus = "processing";
      }
    }

    return res.status(status.OK).json({ queryStatus, documents: documentsDTO });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Downloads the specified document for the specified patient.
 *
 * @param req.query.fileName The file name of the document in s3.
 * @return presigned url
 */
router.get(
  "/download",
  asyncHandler(async (req: Request, res: Response) => {
    const fileName = getFromQuery("fileName", req);

    const url = await s3client.getSignedUrl("getObject", {
      // NEED TO UPDATE THIS
      Bucket: "testing-documents-download",
      Key: fileName,
      Expires: 100,
    });

    return res.status(status.OK).json({ url });
  })
);

export default router;
