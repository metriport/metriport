import { Bundle, Resource } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import {
  buildDocumentNameForConversionResult,
  buildKeyForConversionFhir,
} from "../../domain/conversion/filename";
import { buildBatchBundleFromResources } from "../../external/fhir/bundle/bundle";
import { out } from "../../util/log";
import { JSON_TXT_MIME_TYPE } from "../../util/mime";
import { capture } from "../../util/notifications";
import { getPayloadPartitions, saveConverterStep } from "./utils";

const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;

export type ConversionFhirRequest = {
  cxId: string;
  patientId: string;
  requestId?: string;
  inputS3Key: string;
  inputS3BucketName: string;
};

export type ConverterRequest = {
  payload: string;
  params: FhirConverterParams;
};

export abstract class ConversionFhirHandler {
  async convertToFhir(params: ConversionFhirRequest): Promise<{
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
    const converterParams: FhirConverterParams = {
      patientId,
      fileName: buildKeyForConversionFhir({
        cxId,
        patientId,
        requestId,
        fileName: preConversionFileName,
      }),
      // TODO Eng-531: Make these optional
      unusedSegments: "false",
      invalidAccess: "false",
    };
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
      const conversionResult = await this.callConverter({ payload, params: converterParams });
      if (!conversionResult || !conversionResult.entry || conversionResult.entry.length < 1) {
        continue;
      }
      for (const entry of conversionResult.entry) {
        if (entry.resource) resources.add(entry.resource);
      }
    }
    const bundle = buildBatchBundleFromResources([...resources.values()]);
    const { key: resultKey, bucket: resultBucket } = await saveConverterStep({
      paramsWithRequestId,
      result: bundle,
      contentType: JSON_TXT_MIME_TYPE,
      fileName: buildDocumentNameForConversionResult(requestId),
      stepName: "result",
    });
    return { bundle, resultKey, resultBucket };
  }

  abstract callConverter(params: ConverterRequest): Promise<Bundle<Resource>>;
}
