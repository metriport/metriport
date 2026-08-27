import axios from "axios";
import { createJobId } from "@metriport/core/domain/job";
import { buildConversionResultHandler } from "@metriport/core/command/conversion-result/conversion-result-factory";
import { Config } from "../../shared/config";
import { makeS3Client } from "../aws/s3";
import { FHIRConverterConnector, FHIRConverterRequest } from "./connector";
import { storeInS3WithRetries } from "@metriport/core/external/aws/s3";
import { getS3UtilsInstance } from "@metriport/core/external/ehr/bundle/bundle-shared";
import { out } from "@metriport/core/util/log";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";

export function buildUrl(url: string, sourceType: string, template: string): string {
  return `${url}/api/convert/${sourceType}/${template}`;
}

// TODO Could rename this to *Local and have other similar approaches to CW and other external services... then,
// we could have a local folder with files that we use to mock the download from/upload to external services.
export class FHIRConverterConnectorHTTP implements FHIRConverterConnector {
  private readonly conversionResultHandler = buildConversionResultHandler();

  async requestConvert({
    cxId,
    patientId,
    documentId,
    requestId,
    sourceType,
    payload,
    template,
    unusedSegments,
    invalidAccess,
    source,
  }: FHIRConverterRequest): Promise<void> {
    const { log } = out(
      `requestConvert.local - cx ${cxId}, patient ${patientId}, requestId ${requestId}, docId ${documentId}`
    );
    const fhirConverterUrl = Config.getFHIRConverterServerURL();
    if (!fhirConverterUrl) {
      log(`FHIR_CONVERTER_SERVER_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const url = buildUrl(fhirConverterUrl, sourceType, template);
    const jobId = createJobId(requestId, documentId);

    // Gotta download the contents from S3 since the payload is just a reference to the actual file
    const s3 = makeS3Client();
    const payloadJson = JSON.parse(payload);
    const s3BucketName = payloadJson.s3BucketName;
    if (!s3BucketName) throw new Error(`Missing s3BucketName in payload: ${payload}`);
    const s3FileName = payloadJson.s3FileName;
    if (!s3FileName) throw new Error(`Missing s3FileName in payload: ${payload}`);

    try {
      log(`Downloading ${s3FileName} from ${s3BucketName}...`);
      const obj = await s3
        .getObject({
          Bucket: s3BucketName,
          Key: s3FileName,
        })
        .promise();
      const data = obj.Body?.toString("utf-8");

      log(`Sending payload to ${url}...`);
      const resp = await axios.post(url, data, {
        params: {
          patientId,
          unusedSegments,
          invalidAccess,
          source,
        },
        headers: { "Content-Type": "text/plain" },
      });

      const convertedFileName = `${s3FileName}.json`;
      log(
        `Storing converted file ${convertedFileName} in ${Config.getMedicalDocumentsBucketName()}...`
      );
      await storeInS3WithRetries({
        s3Utils: getS3UtilsInstance(),
        payload: JSON.stringify(resp.data.fhirResource),
        bucketName: Config.getMedicalDocumentsBucketName(),
        fileName: convertedFileName,
        contentType: "application/json",
        log,
      });

      log(`Sending result info to the API`);
      await executeWithNetworkRetries(
        async () =>
          this.conversionResultHandler.notifyApi(
            {
              cxId,
              patientId,
              jobId,
              source,
              status: "success",
            },
            log
          ),
        {
          retryOnTimeout: true,
          maxAttempts: 3,
        }
      );
    } catch (error) {
      const errorMessage = errorToString(error);
      log(`Conversion failed: ${errorMessage}`);
      await executeWithNetworkRetries(
        async () =>
          this.conversionResultHandler.notifyApi(
            {
              cxId,
              patientId,
              jobId,
              source,
              status: "failed",
              details: errorMessage,
            },
            log
          ),
        {
          retryOnTimeout: true,
          maxAttempts: 3,
        }
      );
      throw error;
    }
  }
}
