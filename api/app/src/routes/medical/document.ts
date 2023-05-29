import { Request, Response } from "express";
import Router from "express-promise-router";
import { OK } from "http-status";
import { downloadDocument } from "../../command/medical/document/document-download";
import {
  createQueryResponse,
  queryDocumentsAcrossHIEs,
} from "../../command/medical/document/document-query";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
// import ForbiddenError from "../../errors/forbidden";
import { getDocuments } from "../../external/fhir/document/get-documents";
// import { Config } from "../../shared/config";
import { stringToBoolean } from "../../shared/types";
import { asyncHandler, getCxIdOrFail, getFrom, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";

const router = Router();

/** ---------------------------------------------------------------------------
 * GET /document
 *
 * Queries for all available document metadata for the specified patient across HIEs.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @return The metadata of available documents.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);

    const documents = await getDocuments({ cxId, patientId });
    const documentsDTO = toDTO(documents);

    const patient = await getPatientOrFail({ cxId, id: patientId });

    const queryResp = createQueryResponse(patient.data.documentQueryStatus ?? "completed", patient);

    return res.status(OK).json({
      ...queryResp,
      documents: documentsDTO,
    });
  })
);

/** ---------------------------------------------------------------------------
 * GET /document/query
 *
 * Triggers a document query for the specified patient across HIEs.
 *
 * @param req.query.patientId Patient ID for which to retrieve document metadata.
 * @param req.query.facilityId The facility providing NPI for the document query.
 * @param req.query.override Whether to override files already downloaded (optional, defaults to false).
 * @return The status of document querying.
 */
router.post(
  "/query",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const patientId = getFromQueryOrFail("patientId", req);
    const facilityId = getFromQueryOrFail("facilityId", req);
    const override = stringToBoolean(getFrom("query").optional("override", req));

    const { queryStatus, queryProgress } = await queryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      override,
    });

    return res.status(OK).json({ queryStatus, queryProgress });
  })
);

/** ---------------------------------------------------------------------------
 * GET /downloadUrl
 *
 * Fetches the document from S3 and sends a presigned URL
 *
 * @param req.query.fileName The file name of the document in s3.
 * @param req.query.conversionType The doc type to convert to.
 * @return presigned url
 */
router.get(
  "/downloadUrl",
  asyncHandler(async (req: Request, res: Response) => {
    // const cxId = getCxIdOrFail(req);
    const fileName = getFromQueryOrFail("fileName", req);
    // const fileHasCxId = fileName.includes(cxId);
    // const conversionType = getFrom("query").optional("conversionType", req);

    // if (!fileHasCxId && !Config.isSandbox()) throw new ForbiddenError();

    const url = await downloadDocument({ fileName });

    return res.status(OK).json({ url });
  })
);

export default router;
