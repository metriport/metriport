import { Bundle, Resource } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import {
  buildDocumentNameForConversionResult,
  buildDocumentNameForPartialConversions,
  buildKeyForConversionFhir,
} from "../../domain/conversion/filename";
import { buildBatchBundleFromResources } from "../../external/fhir/bundle/bundle";
import { out } from "../../util/log";
import { JSON_TXT_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../util/mime";
import { capture } from "../../util/notifications";
import { getPayloadPartitions, saveConverterStep } from "./utils";

const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;

export type ConversionFhirRequestCloud = {
  cxId: string;
  patientId: string;
  requestId?: string;
  inputS3Key: string;
  inputS3BucketName: string;
};

export type ConversionFhirRequestLocal = {
  cxId: string;
  patientId: string;
  payload: string;
  requestId?: string;
};

export type ConverterRequest = ConversionFhirRequestCloud | ConversionFhirRequestLocal;

export abstract class ConversionFhirHandler {
  async convertToFhir(params: ConverterRequest): Promise<{
    bundle: Bundle;
    resultKey: string;
    resultBucket: string;
  }> {
    const { cxId, patientId } = params;
    const { log } = out(`convertPayloadToFHIR - cxId ${cxId} patientId ${patientId}`);
    const requestId = params.requestId ?? uuidv7();
    const paramsWithRequestId = { ...params, requestId };
    const { partitionedPayloads, preConversionFileName } = await getPayloadPartitions(
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
            patientId,
            fileName: preConversionFileName,
          },
          level: "warning",
        });
      }
      const partFileName = buildDocumentNameForPartialConversions(preConversionFileName, index);
      const { key: s3Key, bucket: s3Bucket } = await saveConverterStep({
        params: paramsWithRequestId,
        result: payload,
        contentType: XML_TXT_MIME_TYPE,
        fileName: partFileName,
        stepName: "partition",
      });
      const conversionFhirS3Key = buildKeyForConversionFhir({
        cxId,
        patientId,
        requestId,
        fileName: preConversionFileName,
      });
      const converterParams: FhirConverterParams = {
        cxId,
        patientId,
        fileName: conversionFhirS3Key,
        s3Key,
        s3Bucket,
        unusedSegments: "false",
        invalidAccess: "false",
      };
      const conversionResult = await this.callConverter(converterParams, payload);
      if (!conversionResult || !conversionResult.entry || conversionResult.entry.length < 1) {
        continue;
      }
      for (const entry of conversionResult.entry) {
        if (entry.resource) resources.add(entry.resource);
      }
    }
    const bundle = buildBatchBundleFromResources([...resources.values()]);
    const { key: resultKey, bucket: resultBucket } = await saveConverterStep({
      params: paramsWithRequestId,
      result: bundle,
      contentType: JSON_TXT_MIME_TYPE,
      fileName: buildDocumentNameForConversionResult(requestId),
      stepName: "result",
    });
    return { bundle, resultKey, resultBucket };
  }

  /**
   * Calls the FHIR converter with the given parameters.
   * @param params - Converter parameters including s3Key for S3-based retrieval
   * @param payload - WARNING DEPRECATED Raw payload content. Only used by ConversionFhirDirect for local
   *                  development. Cloud implementations should use params.s3Key instead.
   */
  abstract callConverter(params: FhirConverterParams, payload?: string): Promise<Bundle<Resource>>;
}
