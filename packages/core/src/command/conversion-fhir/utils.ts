import { Bundle, Resource } from "@medplum/fhirtypes";
import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { cleanUpPayload } from "../../domain/conversion/cleanup";
import {
  buildDocumentNameForCleanConversion,
  buildDocumentNameForPreConversion,
  buildKeyForConversionFhir,
} from "../../domain/conversion/filename";
import { S3Utils } from "../../external/aws/s3";
import { getSanitizedContents } from "../../external/cda/get-file-contents";
import { partitionPayload } from "../../external/cda/partition-payload";
import { removeBase64PdfEntries } from "../../external/cda/remove-b64";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { JSON_TXT_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../util/mime";
import { ConverterRequest } from "./conversion-fhir";

function getS3Utils(): S3Utils {
  return new S3Utils(Config.getAWSRegion());
}

type RequestWithRequestId = ConverterRequest & { requestId: string };

export async function getPayloadPartitions(
  params: RequestWithRequestId
): Promise<{ partitionedPayloads: string[]; preConversionFileName: string }> {
  const { cxId, patientId, requestId } = params;
  const { log } = out(
    `getConverterParamsAndPayloadPartitions - cxId ${cxId} patientId ${patientId} requestId ${requestId}`
  );

  // Local: use payload directly, Cloud: fetch from S3
  const payloadRaw =
    "payload" in params
      ? params.payload
      : await getS3Utils().getFileContentsAsString(params.inputS3BucketName, params.inputS3Key);

  const additionalInfo = { cxId, patientId };
  if (payloadRaw.includes("nonXMLBody")) {
    throw new BadRequestError("XML document is unstructured CDA with nonXMLBody", undefined, {
      ...additionalInfo,
    });
  }
  const preConversionFileName = buildDocumentNameForPreConversion(requestId);
  await saveConverterStep({
    params,
    result: payloadRaw,
    contentType: XML_TXT_MIME_TYPE,
    fileName: preConversionFileName,
    stepName: "pre-conversion",
    throwError: false,
  });
  const { documentContents, b64Attachments } = removeBase64PdfEntries(
    getSanitizedContents(payloadRaw)
  );
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
    params,
    result: payloadClean,
    contentType: XML_TXT_MIME_TYPE,
    fileName: buildDocumentNameForCleanConversion(requestId),
    stepName: "clean",
    throwError: false,
  });
  const partitionedPayloads = partitionPayload(payloadClean);
  return { partitionedPayloads, preConversionFileName };
}

export async function saveConverterStep({
  params,
  result,
  contentType,
  fileName,
  stepName,
  throwError = true,
}: {
  params: RequestWithRequestId;
  result: string | Bundle<Resource>;
  contentType: typeof JSON_TXT_MIME_TYPE | typeof XML_TXT_MIME_TYPE;
  fileName: string;
  stepName: string;
  throwError?: boolean;
}): Promise<{ key: string; bucket: string }> {
  const { cxId, patientId, requestId } = params;
  const { log } = out(
    `saveConverterStep - cxId ${cxId} patientId ${patientId} requestId ${requestId}`
  );
  const s3Utils = getS3Utils();
  const bucket = Config.getFhirConversionBucketName();
  const key = buildKeyForConversionFhir({ cxId, patientId, requestId, fileName });
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
      throw new MetriportError(msg, error, { cxId, patientId, fileName });
    }
  }
  return { key, bucket };
}
