import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { cleanUpPayload } from "../../domain/conversion/cleanup";
import { S3Utils } from "../../external/aws/s3";
import { partitionPayload } from "../../external/cda/partition-payload";
import { removeBase64PdfEntries } from "../../external/cda/remove-b64";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { ConversionFhirRequest } from "./conversion-fhir";

const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;

export async function convertPayloadToFHIR({
  convertToFhir,
  params,
}: {
  convertToFhir: (payload: string, parmas: FhirConverterParams) => Promise<Bundle<Resource>>;
  params: ConversionFhirRequest;
}): Promise<Bundle<Resource>> {
  const { log } = out(`convertCDAToFHIR - cxId ${params.cxId} patientId ${params.patientId}`);
  const { converterParams, partitionedPayloads } = await getConverterParamsAndPayloadPartitions(
    params
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
  return combinedBundle;
}

export async function getConverterParamsAndPayloadPartitions(
  params: ConversionFhirRequest
): Promise<{ converterParams: FhirConverterParams; partitionedPayloads: string[] }> {
  const { patientId, keepUnusedSegments = false, keepInvalidAccess = false } = params;
  const { payloadRaw, fileName } = await getPayloadAndFilename(params);
  if (payloadRaw.includes("nonXMLBody")) {
    throw new BadRequestError("XML document is unstructured CDA with nonXMLBody");
  }
  const { documentContents } = removeBase64PdfEntries(payloadRaw);
  const payloadClean = cleanUpPayload(documentContents).trim();
  if (payloadClean.length < 1) throw new BadRequestError("XML document is empty");
  const converterParams: FhirConverterParams = {
    patientId,
    fileName,
    unusedSegments: `${keepUnusedSegments}`,
    invalidAccess: `${keepInvalidAccess}`,
  };
  const partitionedPayloads = partitionPayload(payloadClean);
  return { converterParams, partitionedPayloads };
}

export async function getPayloadAndFilename(
  params: ConversionFhirRequest
): Promise<{ payloadRaw: string; fileName: string }> {
  const { s3File, rawData } = params;
  let payloadRaw: string;
  let fileName: string;
  if (s3File) {
    const s3BucketName = s3File.bucketName;
    const s3FileName = s3File.fileName;
    const s3Utils = new S3Utils(Config.getAWSRegion());
    payloadRaw = await s3Utils.getFileContentsAsString(s3BucketName, s3FileName);
    fileName = s3FileName;
  } else if (rawData) {
    payloadRaw = rawData;
    fileName = uuidv7();
  } else {
    throw new BadRequestError("Either s3File or rawData must be provided");
  }
  return { payloadRaw, fileName };
}
