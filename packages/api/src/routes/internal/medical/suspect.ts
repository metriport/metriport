import { MetriportError } from "@metriport/shared";
import { Router } from "express";
import { createSuspectsFromS3 } from "../../../command/medical/patient/create-suspects-from-s3";
import { z } from "zod";

const suspectRouter = Router();

const importSuspectsSchema = z.object({
  cxId: z.string(),
  key: z.string(),
});

/**
 * POST /internal/medical/suspect/import
 * Body: { cxId: string, key: string }
 */
suspectRouter.post("/import", async function (req, res, next) {
  try {
    const { cxId, key } = importSuspectsSchema.parse(req.body);

    await createSuspectsFromS3({ cxId, key });

    return res.status(204).send();
  } catch (error) {
    // Keep stack trace for upstream error handling
    next(new MetriportError("Failed to import suspects from S3", { cause: error }));
  }
});

export default suspectRouter;
