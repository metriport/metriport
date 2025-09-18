import { Router } from "express";
import { createSuspectsFromS3 } from "../../../command/medical/patient/create-suspect-from-s3";
import { MetriportError } from "@metriport/shared";

const suspectRouter = Router();

/**
 * POST /internal/medical/suspect/import
 * Body: { cxId: string, bucket: string, key: string }
 */
suspectRouter.post("/import", async function (req, res, next) {
  try {
    const { cxId, bucket, key } = req.body ?? {};

    if (!cxId || !bucket || !key) {
      // Only explain why: ensure all required fields are present for S3 import
      return res.status(400).json({
        error: "Missing required fields: cxId, bucket, and key are required.",
      });
    }

    await createSuspectsFromS3({ cxId, bucket, key });

    return res.status(204).send();
  } catch (error) {
    // Keep stack trace for upstream error handling
    next(new MetriportError("Failed to import suspects from S3", { cause: error }));
  }
});

export default suspectRouter;
