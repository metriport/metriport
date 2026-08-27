import { isDebugFeatureFlagEnabled } from "@metriport/core/command/feature-flags/domain-ffs";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { ensureCcdExists } from "@metriport/core/shareback/ensure-ccd-exists";
import {
  createCcdDocumentPath,
  getMetadataFilePathFromDocumentFilePath,
} from "@metriport/core/shareback/file";
import { out } from "@metriport/core/util/log";
import { executeWithRetries, NotFoundError } from "@metriport/shared";
import Router from "express-promise-router";
import { requestLogger } from "../../../routes/helpers/request-logger";
import { asyncHandler } from "../../../routes/util";
import { Config } from "../../../shared/config";
import {
  getPatientAndCxFromRequest,
  processRequest,
  shouldRetryMetadataCleanup,
} from "./cw-process-request";
import { fhirServerUrl, proxyPrefix } from "./shared";

/**
 * Endpoints to process CW's Document Query (DQ) requests.
 *
 * Example of a DQ request:
 *   /DocumentReference?
 *   &_include=DocumentReference:patient
 *   &_include=DocumentReference:subject
 *   &_include=DocumentReference:authenticator
 *   &_include=DocumentReference:author
 *   &_include=DocumentReference:custodian
 *   &_include=DocumentReference:encounter
 *   &category=('34133-9%5E%5E2.16.840.1.113883.6.1')
 *   &patient.identifier=urn:oid:2.16.840.1.113883.3.9621.5.000%7C508fd256-8748-4c36-a960-6d92feecbb9a
 *   &status=current
 */
const fhirRouter = Router();

fhirRouter.get(
  "/DocumentReference",
  requestLogger,
  asyncHandler(
    async (req, res) => {
      try {
        const bundle = await processRequest(req);
        return res.status(200).json(bundle);
        // TODO ENG-1664 Remove this once errors get to zero per day
      } catch (error) {
        // TEMPORARY: delete metadata from S3 and try again
        if (!shouldRetryMetadataCleanup(error)) throw error;
        const { cxId, patientId } = await getPatientAndCxFromRequest(req);
        const { log } = out(`${proxyPrefix} - cxId ${cxId}, patientId ${patientId}`);
        log(
          `Trying again after deleting metadata from S3 and recreating the CCD + Metadata file...`
        );
        await deleteDocumentMetadataFileFromS3(cxId, patientId);
        await ensureCcdExists({ cxId, patientId, log });
        try {
          const bundleInternal = await executeWithRetries(async () => processRequest(req), {
            maxAttempts: 7,
            initialDelay: 100,
            maxDelay: 500,
            log,
          });
          return res.status(200).json(bundleInternal);
        } catch (error) {
          // In the last attempt, return what we can
          log(`Failed, trying again to return what we can (skip errors)...`);
          const bundleInternal = await processRequest(req, true);
          return res.status(200).json(bundleInternal);
        }
      }
    },
    async () => isDebugFeatureFlagEnabled()
  )
);

// TODO ENG-1664 Remove this once errors get to zero per day
async function deleteDocumentMetadataFileFromS3(cxId: string, patientId: string): Promise<void> {
  const documentFilePath = createCcdDocumentPath({ cxId, patientId });
  const metadataFilePath = getMetadataFilePathFromDocumentFilePath(documentFilePath);
  const s3Utils = new S3Utils(Config.getAWSRegion());
  await Promise.all([
    s3Utils.deleteFile({
      bucket: Config.getMedicalDocumentsBucketName(),
      key: documentFilePath,
    }),
    s3Utils.deleteFile({
      bucket: Config.getMedicalDocumentsBucketName(),
      key: metadataFilePath,
    }),
  ]);
}

fhirRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError();
  })
);

const dummyRouter = Router();
dummyRouter.all(
  "/*",
  requestLogger,
  asyncHandler(async () => {
    throw new NotFoundError(`FHIR server for CW is disabled`);
  })
);

const router = fhirServerUrl ? fhirRouter : dummyRouter;

export default router;
