import { MedplumClient } from "@medplum/core";
import { Config } from "../../../shared/config";
import { Util } from "../../../shared/util";
import { makeS3Client } from "../../aws/s3";
import { FHIRServerConnector, FHIRServerRequest } from "./connector";

export class FHIRServerConnectorHTTP implements FHIRServerConnector {
  async upsertBatch({ cxId, patientId, payload, requestId }: FHIRServerRequest): Promise<void> {
    const serverUrl = Config.getFHIRServerUrl();

    // Gotta download the contents from S3 since the payload is just a reference to the actual file
    const s3 = makeS3Client();
    const payloadJson = JSON.parse(payload);
    const s3BucketName = payloadJson.s3BucketName;
    if (!s3BucketName) throw new Error(`Missing s3BucketName in payload: ${payload}`);
    const s3FileName = payloadJson.s3FileName;
    if (!s3FileName) throw new Error(`Missing s3FileName in payload: ${payload}`);

    const { log } = Util.out(
      `upsertBatch, patientId ${patientId}, requestId ${requestId}, s3FileName ${s3FileName}`
    );

    log(`Downloading from ${s3BucketName}...`);
    const obj = await s3
      .getObject({
        Bucket: s3BucketName,
        Key: s3FileName,
      })
      .promise();
    if (!obj.Body) throw new Error(`Missing Body on S3 object`);

    const data = obj.Body.toString("utf-8");
    const batch = JSON.parse(data).fhirResource;

    log(`Sending payload to ${serverUrl}...`);
    const fhirApi = new MedplumClient({
      baseUrl: serverUrl,
      fhirUrlPath: `fhir/${cxId}`,
    });
    await fhirApi.executeBatch(batch);
    log(`Done.`);
  }
}
