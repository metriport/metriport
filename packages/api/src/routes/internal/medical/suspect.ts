import { Request, Response, Router } from "express";
import status from "http-status";
import { z } from "zod";
import { createSuspectsFromS3 } from "../../../command/medical/patient/create-suspects-from-s3";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler } from "../../util";

const router = Router();

const importSuspectsSchema = z.object({
  cxId: z.string(),
  key: z.string(),
});

/**
 * Handles importing suspect patients from an S3 bucket.
 *
 * @route POST /internal/medical/suspect/import
 * @param req.body.cxId - The customer ID as a string.
 * @param req.body.key - The S3 object key as a string.
 * @returns 200 OK with { status: "success" } if import is successful.
 * @throws {MetriportError} If the import fails, with the original error as the cause.
 */
router.post(
  "/import",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const { cxId, key } = importSuspectsSchema.parse(req.body);

    await createSuspectsFromS3({ cxId, key });

    return res.status(status.OK).json({ status: "success" });
  })
);

export default router;
