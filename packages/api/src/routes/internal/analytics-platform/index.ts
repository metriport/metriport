import { buildFhirToCsvIncrementalHandler } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/incremental/fhir-to-csv-incremental-factory";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getFromQueryOrFail } from "../../util";

const router = Router();

/**
 * POST /internal/analytics-platform/ingestion/incremental
 *
 * Runs the incremental ingestion into the analytics platform, for a single patient.
 *
 * @param req.query.cxId - The CX ID.
 * @param req.query.patientId - The patient ID.
 * @returns 200 OK
 */
router.post(
  "/ingestion/incremental",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFromQueryOrFail("cxId", req);
    const patientId = getFromQueryOrFail("patientId", req);

    // validate cx<>patient
    await getPatientOrFail({ id: patientId, cxId });

    const handler = buildFhirToCsvIncrementalHandler();
    await handler.processFhirToCsvIncremental({ cxId, patientId });

    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
