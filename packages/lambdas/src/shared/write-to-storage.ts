import {
  ProcessWriteToS3Request,
  isServiceId,
} from "@metriport/core/command/write-to-storage/s3/write-to-s3";
import { MetriportError } from "@metriport/shared";

interface ProcessWriteToS3Payload {
  serviceId: unknown;
  bucket: unknown;
  filePath: unknown;
  key: unknown;
  payload: unknown;
  contentType: unknown;
  metadata: unknown;
}

export function parseWriteToS3(bodyAsJson: ProcessWriteToS3Payload): ProcessWriteToS3Request {
  const serviceIdRaw = bodyAsJson.serviceId;
  if (!serviceIdRaw) throw new MetriportError("Missing serviceId");
  if (typeof serviceIdRaw !== "string") throw new MetriportError("Invalid serviceId");
  if (!isServiceId(serviceIdRaw)) throw new MetriportError("Invalid serviceId");

  const bucketRaw = bodyAsJson.bucket;
  if (!bucketRaw) throw new MetriportError("Missing bucket");
  if (typeof bucketRaw !== "string") throw new MetriportError("Invalid bucket");

  const filePathRaw = bodyAsJson.filePath;
  if (!filePathRaw) throw new MetriportError("Missing filePath");
  if (typeof filePathRaw !== "string") throw new MetriportError("Invalid filePath");

  const keyRaw = bodyAsJson.key;
  const valiKey = typeof keyRaw === "string" || keyRaw === undefined;
  if (!valiKey) throw new MetriportError("Invalid key");

  const payloadRaw = bodyAsJson.payload;
  if (!payloadRaw) throw new MetriportError("Missing payload");
  if (typeof payloadRaw !== "string") throw new MetriportError("Invalid payload");

  const contentTypeRaw = bodyAsJson.contentType;
  const validContentType = typeof contentTypeRaw === "string" || contentTypeRaw === undefined;
  if (!validContentType) throw new MetriportError("Invalid contentType");

  let metadata: Record<string, string> | undefined;
  const metadataRaw = bodyAsJson.metadata;
  const validMetadata = typeof metadataRaw === "string" || metadataRaw === undefined;
  if (!validMetadata) throw new MetriportError("Invalid metadata");
  if (metadataRaw) {
    metadata = JSON.parse(metadataRaw) as Record<string, string>;
  }

  return {
    serviceId: serviceIdRaw,
    bucket: bucketRaw,
    filePath: filePathRaw,
    key: keyRaw,
    payload: payloadRaw,
    contentType: contentTypeRaw,
    metadata,
  };
}
