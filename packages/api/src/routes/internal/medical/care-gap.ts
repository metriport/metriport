import { Request, Response, Router } from "express";
import status from "http-status";
import { z } from "zod";
import { createCareGapsFromS3 } from "../../../command/medical/patient/create-care-gaps-from-s3";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

const router = Router();

const importCareGapsSchema = z.object({
  cxId: z.string(),
  jobId: z.string(),
});

/**
 * Handles importing care gaps from an S3 bucket.
 *
 * @route POST /internal/medical/care-gap/import
 * @param req.body.cxId - The customer ID as a string.
 * @param req.body.jobId - The job ID as a string.
 * @returns 200 OK with { status: "success" } if import is successful.
 * @throws {MetriportError} If the import fails, with the original error as the cause.
 */
router.post(
  "/import",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, jobId } = importCareGapsSchema.parse(req.body);

    await createCareGapsFromS3({ cxId, jobId });

    return res.status(status.OK).json({ status: "success" });
  })
);

export default router;
