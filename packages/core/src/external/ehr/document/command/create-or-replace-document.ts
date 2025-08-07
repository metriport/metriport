import {
  BadRequestError,
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
} from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import {
  createKeyAndExtensionMap,
  DocumentKeyBaseParams,
  getS3UtilsInstance,
} from "../document-shared";

export type CreateOrReplaceDocumentParams = DocumentKeyBaseParams & {
  payload: string;
};

/**
 * Creates or replaces a document.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param documentType - The type of the document.
 * @param payload - The payload of the document.
 * @param resourceType - The resource type of the CCDA file.
 * @param jobId - The job ID of the CCDA file. If not provided, the tag 'latest' will be used.
 * @param resourceId - The resource ID of the document.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 */
export async function createOrReplaceDocument({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  documentType,
  payload,
  resourceType,
  jobId,
  resourceId,
  s3BucketName = Config.getEhrBundleBucketName(),
}: CreateOrReplaceDocumentParams): Promise<{
  s3key: string;
  s3BucketName: string;
}> {
  const { log } = out(
    `Ehr createOrReplaceCcda - ehr ${ehr} cxId ${cxId} ehrPatientId ${ehrPatientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const createKeyAndExtension = createKeyAndExtensionMap[documentType];
  if (!createKeyAndExtension)
    throw new BadRequestError("Invalid document type", undefined, { documentType });
  const key = createKeyAndExtension.key({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
    resourceId,
  });
  try {
    await executeWithNetworkRetries(async () => {
      await s3Utils.uploadFile({
        bucket: s3BucketName,
        key,
        file: Buffer.from(payload, "utf8"),
        contentType: createKeyAndExtension.extension,
      });
    });
    return { s3key: key, s3BucketName };
  } catch (error) {
    const msg = `Failure while creating or replacing EHR document @ S3`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      resourceType,
      key,
      extension: createKeyAndExtension.extension,
      context: "ehr.createOrReplaceDocument",
    });
  }
}
