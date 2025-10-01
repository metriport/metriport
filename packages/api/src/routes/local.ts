import { retrieveDocumentForCommonWell } from "@metriport/core/external/commonwell/contribution/shared-document-retrieval";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { BadRequestError, errorToString } from "@metriport/shared";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { Config } from "../shared/config";
import { asyncHandler, getFrom } from "./util";
import { log } from "@metriport/core/util/log";

const router = Router();

/** ---------------------------------------------------------------------------------------
 * GET /doc-contribution/commonwell
 *
 * This is a local development route only, and uses the same logic as the `cw-doc-contribution` lambda.
 *
 * Used to test the document retrieval part of the contribution logic for CommonWell.
 *
 * NOTE: For CW to send a request to your local env, you need to rig the flow in 2 places:
 *   1. In `cw-process-request`, the resulting bundle should have the localhost address be replaced with your ngrok address.
 *   2. In the CW portal, update your organization to use the <your-ngrok-address/oauth/fhir> under Gateway > FHIR R4 Endpoint.
 *
 * @param req.query.fileName The file name to retrieve the document for. The value for this comes from the
 *  `oauth/fhir` route that responds to incoming document queries.
 * @returns A FHIR Binary resource with the document data.
 */
router.get(
  "/doc-contribution/commonwell",
  asyncHandler(async (req: Request, res: Response) => {
    if (!Config.isDev()) {
      throw new BadRequestError("This route is only available in dev environment");
    }

    const startedAt = Date.now();
    try {
      const fileName = getFrom("query").orFail("fileName", req);
      const s3Utils = new S3Utils(Config.getAWSRegion());
      const bucketName = Config.getMedicalDocumentsBucketName();

      const binary = await retrieveDocumentForCommonWell({
        fileName,
        s3Utils,
        bucketName,
      });

      log(`Binary details: ${JSON.stringify({ ...binary, data: "REDACTED" })}`);

      return res.status(200).json(binary);
    } catch (error) {
      const msg = `Error processing DR from CW`;
      console.log(`${msg}: ${errorToString(error)}`);
      return res.status(500).send("Internal Server Error");
    } finally {
      log(`Sending binary. Took ${Date.now() - startedAt}ms`);
    }
  })
);

export default router;
