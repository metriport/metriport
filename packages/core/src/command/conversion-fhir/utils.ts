import { Bundle, Resource } from "@medplum/fhirtypes";
import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { cleanUpPayload } from "../../domain/conversion/cleanup";
import {
  buildDocumentNameForCleanConversion,
  buildDocumentNameForPreConversion,
  buildKeyForConversionFhir,
} from "../../domain/conversion/filename";
import { S3Utils } from "../../external/aws/s3";
import { partitionPayload } from "../../external/cda/partition-payload";
import { removeBase64PdfEntries } from "../../external/cda/remove-b64";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { JSON_TXT_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../util/mime";
import { ConversionFhirRequest } from "./conversion-fhir";

function getS3Utils(): S3Utils {
  return new S3Utils(Config.getAWSRegion());
}

type ConversionFhirRequestWithRequestId = Omit<ConversionFhirRequest, "requestId"> & {
  requestId: string;
};

export async function getPayloadPartitions(
  paramsWithRequestId: ConversionFhirRequestWithRequestId
): Promise<{ partitionedPayloads: string[]; preConversionFileName: string }> {
  const { log } = out(
    `getConverterParamsAndPayloadPartitions - cxId ${paramsWithRequestId.cxId} patientId ${paramsWithRequestId.patientId} requestId ${paramsWithRequestId.requestId}`
  );
  const s3Utils = getS3Utils();
  const payloadRaw = await s3Utils.getFileContentsAsString(
    paramsWithRequestId.inputS3BucketName,
    paramsWithRequestId.inputS3Key
  );
  const additionalInfo = {
    cxId: paramsWithRequestId.cxId,
    patientId: paramsWithRequestId.patientId,
    inputS3Key: paramsWithRequestId.inputS3Key,
    inputS3BucketName: paramsWithRequestId.inputS3BucketName,
  };
  if (payloadRaw.includes("nonXMLBody")) {
    throw new BadRequestError("XML document is unstructured CDA with nonXMLBody", undefined, {
      ...additionalInfo,
    });
  }
  const preConversionFileName = buildDocumentNameForPreConversion(paramsWithRequestId.requestId);
  await saveConverterStep({
    paramsWithRequestId,
    result: payloadRaw,
    contentType: XML_TXT_MIME_TYPE,
    fileName: preConversionFileName,
    stepName: "pre-conversion",
    throwError: false,
  });
  const { documentContents, b64Attachments } = removeBase64PdfEntries(payloadRaw);
  if (b64Attachments && b64Attachments.total > 0) {
    // TODO Eng-517: Process B64 attachments
    log(`Extracted ${b64Attachments.total} B64 attachments - not processing....`);
  }
  const payloadClean = cleanUpPayload(documentContents).trim();
  if (payloadClean.length < 1) {
    throw new BadRequestError("XML document is empty", undefined, {
      ...additionalInfo,
    });
  }
  await saveConverterStep({
    paramsWithRequestId,
    result: payloadClean,
    contentType: XML_TXT_MIME_TYPE,
    fileName: buildDocumentNameForCleanConversion(paramsWithRequestId.requestId),
    stepName: "clean",
    throwError: false,
  });
  const partitionedPayloads = partitionPayload(payloadClean);
  return { partitionedPayloads, preConversionFileName };
}

export async function saveConverterStep({
  paramsWithRequestId,
  result,
  contentType,
  fileName,
  stepName,
  throwError = true,
}: {
  paramsWithRequestId: ConversionFhirRequestWithRequestId;
  result: string | Bundle<Resource>;
  contentType: typeof JSON_TXT_MIME_TYPE | typeof XML_TXT_MIME_TYPE;
  fileName: string;
  stepName: string;
  throwError?: boolean;
}): Promise<{ key: string; bucket: string }> {
  const { log } = out(
    `saveConverterStep - cxId ${paramsWithRequestId.cxId} patientId ${paramsWithRequestId.patientId} requestId ${paramsWithRequestId.requestId}`
  );
  const s3Utils = getS3Utils();
  const bucket = Config.getFhirConversionBucketName();
  const key = buildKeyForConversionFhir({
    cxId: paramsWithRequestId.cxId,
    patientId: paramsWithRequestId.patientId,
    requestId: paramsWithRequestId.requestId,
    fileName,
  });
  try {
    await s3Utils.uploadFile({
      bucket,
      key,
      file: Buffer.from(typeof result === "string" ? result : JSON.stringify(result), "utf8"),
      contentType,
    });
  } catch (error) {
    const msg = `Error saving converter file ${fileName} for step ${stepName}`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    if (throwError) {
      throw new MetriportError(msg, error, {
        cxId: paramsWithRequestId.cxId,
        patientId: paramsWithRequestId.patientId,
        fileName,
      });
    }
  }
  return { key, bucket };
}
