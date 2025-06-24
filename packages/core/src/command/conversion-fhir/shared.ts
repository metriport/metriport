import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { BadRequestError, errorToString } from "@metriport/shared";
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
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { ConversionFhirRequest } from "./conversion-fhir";

const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;

function getS3Utils(): S3Utils {
  return new S3Utils(Config.getAWSRegion());
}

type ConversionFhirRequestWithRequestId = Omit<ConversionFhirRequest, "requestId"> & {
  requestId: string;
};

export async function convertPayloadToFHIR({
  convertToFhir,
  params,
}: {
  convertToFhir: (payload: string, parmas: FhirConverterParams) => Promise<Bundle<Resource>>;
  params: ConversionFhirRequest;
}): Promise<Bundle<Resource>> {
  const { log } = out(`convertCDAToFHIR - cxId ${params.cxId} patientId ${params.patientId}`);
  const requestId = params.requestId ?? uuidv7();
  const paramsWithRequestId: ConversionFhirRequestWithRequestId = { ...params, requestId };
  const { converterParams, partitionedPayloads } = await getConverterParamsAndPayloadPartitions(
    paramsWithRequestId
  );
  const combinedBundle: Bundle<Resource> = {
    resourceType: "Bundle",
    type: "batch",
    entry: [],
  };
  const bundleEntrySet = new Set<BundleEntry<Resource>>();
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
    const conversionResult = await convertToFhir(payload, converterParams);
    if (!conversionResult || !conversionResult.entry || conversionResult.entry.length < 1) continue;
    for (const entry of conversionResult.entry) bundleEntrySet.add(entry);
  }
  combinedBundle.entry = [...bundleEntrySet];
  await Promise.all([
    attemptToSaveConverterStep({
      paramsWithRequestId,
      result: combinedBundle,
      contentType: "application/json",
      fileName: buildDocumentNameForConversionResult(requestId),
      stepName: "result",
    }),
    saveConversionResultToOutputBucket({ params, result: combinedBundle }),
  ]);
  return combinedBundle;
}

export async function getConverterParamsAndPayloadPartitions(
  paramsWithRequestId: ConversionFhirRequestWithRequestId
): Promise<{ converterParams: FhirConverterParams; partitionedPayloads: string[] }> {
  const s3Utils = getS3Utils();
  const payloadRaw = await s3Utils.getFileContentsAsString(
    paramsWithRequestId.inputS3BucketName,
    paramsWithRequestId.inputS3Key
  );
  if (payloadRaw.includes("nonXMLBody")) {
    throw new BadRequestError("XML document is unstructured CDA with nonXMLBody");
  }
  await attemptToSaveConverterStep({
    paramsWithRequestId,
    result: payloadRaw,
    contentType: "text/xml",
    fileName: buildDocumentNameForPreConversion(paramsWithRequestId.requestId),
    stepName: "pre-conversion",
  });
  const { documentContents } = removeBase64PdfEntries(payloadRaw);
  const payloadClean = cleanUpPayload(documentContents).trim();
  if (payloadClean.length < 1) throw new BadRequestError("XML document is empty");
  await attemptToSaveConverterStep({
    paramsWithRequestId,
    result: payloadClean,
    contentType: "text/xml",
    fileName: buildDocumentNameForCleanConversion(paramsWithRequestId.requestId),
    stepName: "clean",
  });
  const converterParams: FhirConverterParams = {
    patientId: paramsWithRequestId.patientId,
    fileName: paramsWithRequestId.outputS3Key,
    unusedSegments: `${paramsWithRequestId.keepUnusedSegments ?? false}`,
    invalidAccess: `${paramsWithRequestId.keepInvalidAccess ?? false}`,
  };
  const partitionedPayloads = partitionPayload(payloadClean);
  return { converterParams, partitionedPayloads };
}

export async function attemptToSaveConverterStep({
  paramsWithRequestId,
  result,
  contentType,
  fileName,
  stepName,
}: {
  paramsWithRequestId: ConversionFhirRequestWithRequestId;
  result: string | Bundle<Resource>;
  contentType: "application/json" | "text/xml";
  fileName: string;
  stepName: string;
}): Promise<void> {
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
    log(
      `Error saving converter file ${fileName} for step ${stepName}. Cause: ${errorToString(error)}`
    );
  }
}

export async function saveConversionResultToOutputBucket({
  params,
  result,
}: {
  params: ConversionFhirRequest;
  result: Bundle<Resource>;
}): Promise<void> {
  const s3Utils = getS3Utils();
  await s3Utils.uploadFile({
    bucket: params.outputS3BucketName,
    key: params.outputS3Key,
    file: Buffer.from(JSON.stringify(result), "utf8"),
    contentType: "application/json",
  });
}
