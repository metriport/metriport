import { Bundle, Resource } from "@medplum/fhirtypes";
import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { cleanUpPayload } from "../../domain/conversion/cleanup";
import {
  buildDocumentNameForCleanConversion,
  buildDocumentNameForConversionResult,
  buildDocumentNameForPreConversion,
  buildKeyForConversionFhir,
} from "../../domain/conversion/filename";
import { S3Utils } from "../../external/aws/s3";
import { partitionPayload } from "../../external/cda/partition-payload";
import { removeBase64PdfEntries } from "../../external/cda/remove-b64";
import { buildBundleFromResources } from "../../external/fhir/bundle/bundle";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { JSON_TXT_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../util/mime";
import { capture } from "../../util/notifications";
import { ConversionFhirRequest, ConverterRequest } from "./conversion-fhir";

const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;

function getS3Utils(): S3Utils {
  return new S3Utils(Config.getAWSRegion());
}

type ConversionFhirRequestWithRequestId = Omit<ConversionFhirRequest, "requestId"> & {
  requestId: string;
};

export async function convertPayloadToFHIR({
  callConverter,
  params,
}: {
  callConverter: (params: ConverterRequest) => Promise<Bundle<Resource>>;
  params: ConversionFhirRequest;
}): Promise<{
  bundle: Bundle<Resource>;
  resultKey: string;
  resultBucket: string;
}> {
  const { log } = out(`convertPayloadToFHIR - cxId ${params.cxId} patientId ${params.patientId}`);
  const requestId = params.requestId ?? uuidv7();
  const paramsWithRequestId: ConversionFhirRequestWithRequestId = { ...params, requestId };
  const { converterParams, partitionedPayloads } = await getConverterParamsAndPayloadPartitions(
    paramsWithRequestId
  );
  const resources = new Set<Resource>();
  for (const [index, payload] of partitionedPayloads.entries()) {
    const chunkSize = new Blob([payload]).size;
    if (chunkSize > LARGE_CHUNK_SIZE_IN_BYTES) {
      const msg = "Chunk size is too large";
      log(`${msg} - chunkSize ${chunkSize} on ${index}`);
      capture.message(msg, {
        extra: {
          chunkSize,
          patientId: converterParams.patientId,
          fileName: converterParams.fileName,
        },
        level: "warning",
      });
    }
    const conversionResult = await callConverter({ payload, params: converterParams });
    if (!conversionResult || !conversionResult.entry || conversionResult.entry.length < 1) continue;
    for (const entry of conversionResult.entry) {
      if (entry.resource) resources.add(entry.resource);
    }
  }
  const bundle = buildBundleFromResources({
    type: "batch",
    resources: [...resources.values()],
  });
  const { key: resultKey, bucket: resultBucket } = await saveConverterStep({
    paramsWithRequestId,
    result: bundle,
    contentType: JSON_TXT_MIME_TYPE,
    fileName: buildDocumentNameForConversionResult(requestId),
    stepName: "result",
  });
  return { bundle, resultKey, resultBucket };
}

async function getConverterParamsAndPayloadPartitions(
  paramsWithRequestId: ConversionFhirRequestWithRequestId
): Promise<{ converterParams: FhirConverterParams; partitionedPayloads: string[] }> {
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
  await saveConverterStep({
    paramsWithRequestId,
    result: payloadRaw,
    contentType: XML_TXT_MIME_TYPE,
    fileName: buildDocumentNameForPreConversion(paramsWithRequestId.requestId),
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
  const converterParams: FhirConverterParams = {
    patientId: paramsWithRequestId.patientId,
    fileName: buildKeyForConversionFhir({
      cxId: paramsWithRequestId.cxId,
      patientId: paramsWithRequestId.patientId,
      requestId: paramsWithRequestId.requestId,
      fileName: buildDocumentNameForConversionResult(paramsWithRequestId.requestId),
    }),
    // TODO Eng-531: Make these optional
    unusedSegments: "false",
    invalidAccess: "false",
  };
  const partitionedPayloads = partitionPayload(payloadClean);
  return { converterParams, partitionedPayloads };
}

async function saveConverterStep({
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
