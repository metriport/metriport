import {
  WriteToS3Request,
  isServiceId,
} from "@metriport/core/command/write-to-storage/s3/write-to-s3";
import { MetriportError } from "@metriport/shared";

interface WriteToS3Payload {
  serviceId: unknown;
  bucket: unknown;
  filePath: unknown;
  fileName: unknown;
  payload: unknown;
  contentType: unknown;
  metadata: unknown;
}

export function parseWriteToS3(bodyAsJson: WriteToS3Payload): WriteToS3Request[number] {
  const serviceIdRaw = bodyAsJson.serviceId;
  if (!serviceIdRaw) throw new MetriportError("Missing serviceId");
  if (typeof serviceIdRaw !== "string") throw new MetriportError("Invalid serviceId");
  if (!isServiceId(serviceIdRaw)) {
    throw new MetriportError("Invalid serviceId", undefined, { serviceIdRaw });
  }

  const bucketRaw = bodyAsJson.bucket;
  if (!bucketRaw) throw new MetriportError("Missing bucket");
  if (typeof bucketRaw !== "string") throw new MetriportError("Invalid bucket");

  const filePathRaw = bodyAsJson.filePath;
  if (!filePathRaw) throw new MetriportError("Missing filePath");
  if (typeof filePathRaw !== "string") throw new MetriportError("Invalid filePath");

  const fileNameRaw = bodyAsJson.fileName;
  const validFileName = typeof fileNameRaw === "string" || fileNameRaw === undefined;
  if (!validFileName) throw new MetriportError("Invalid fileName");

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
    fileName: fileNameRaw,
    payload: payloadRaw,
    contentType: contentTypeRaw,
    metadata,
  };
}
