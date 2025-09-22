import axios from "axios";
import { Config } from "../../shared/config";
import { makeS3Client } from "../aws/s3";
import { FHIRConverterConnector, FHIRConverterRequest } from "./connector";

export function buildUrl(url: string, sourceType: string, template: string): string {
  return `${url}/api/convert/${sourceType}/${template}`;
}

// TODO Could rename this to *Local and have other similar approaches to CW and other external services... then,
// we could have a local folder with files that we use to mock the download from/upload to external services.
export class FHIRConverterConnectorHTTP implements FHIRConverterConnector {
  async requestConvert({
    patientId,
    sourceType,
    payload,
    template,
    unusedSegments,
    invalidAccess,
    source,
  }: FHIRConverterRequest): Promise<void> {
    const fhirConverterUrl = Config.getFHIRConverterServerURL();
    if (!fhirConverterUrl) {
      console.log(`FHIR_CONVERTER_SERVER_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const url = buildUrl(fhirConverterUrl, sourceType, template);

    // Gotta download the contents from S3 since the payload is just a reference to the actual file
    const s3 = makeS3Client();
    const payloadJson = JSON.parse(payload);
    const s3BucketName = payloadJson.s3BucketName;
    if (!s3BucketName) throw new Error(`Missing s3BucketName in payload: ${payload}`);
    const s3FileName = payloadJson.s3FileName;
    if (!s3FileName) throw new Error(`Missing s3FileName in payload: ${payload}`);

    console.log(`Downloading ${s3FileName} from ${s3BucketName}...`);
    const obj = await s3
      .getObject({
        Bucket: s3BucketName,
        Key: s3FileName,
      })
      .promise();
    const data = obj.Body?.toString("utf-8");

    console.log(`Sending payload to ${url}...`);
    const resp = await axios.post(url, data, {
      params: {
        patientId,
        unusedSegments,
        invalidAccess,
        source,
      },
      headers: { "Content-Type": "text/plain" },
    });

    return resp.data.fhirResource;
  }
}
