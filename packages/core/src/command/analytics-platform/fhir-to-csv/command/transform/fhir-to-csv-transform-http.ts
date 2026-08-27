import axios from "axios";
import { executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import {
  FhirToCsvTransformHandler,
  FhirToCsvTransformServiceRequest,
  StartFhirToCsvTransformRequest,
} from "./fhir-to-csv-transform";

export class FhirToCsvTransformHttp implements FhirToCsvTransformHandler {
  constructor(
    private readonly httpEndpoint: string = Config.getFhirToCsvTransformHttpEndpoint(),
    private readonly inputBucket: string = Config.getMedicalDocumentsBucketName(),
    private readonly outputBucket: string | undefined = Config.getAnalyticsBucketName()
  ) {}

  async runFhirToCsvTransform({
    cxId,
    patientId,
    outputPrefix,
    timeoutInMillis,
  }: StartFhirToCsvTransformRequest): Promise<void> {
    const { log } = out(`FhirToCsvTransformHttp - cx ${cxId} pt ${patientId}`);

    if (!this.outputBucket) throw new MetriportError("Output bucket is not set");

    log(`Calling HTTP endpoint ${this.httpEndpoint}/transform`);

    const payload: FhirToCsvTransformServiceRequest = {
      CX_ID: cxId,
      PATIENT_ID: patientId,
      OUTPUT_PREFIX: outputPrefix,
      INPUT_S3_BUCKET: this.inputBucket,
      OUTPUT_S3_BUCKET: this.outputBucket,
    };

    await executeWithNetworkRetries(async () => {
      const response = await axios.post(`${this.httpEndpoint}/transform`, payload, {
        headers: { "Content-Type": "application/json" },
        ...(timeoutInMillis !== undefined ? { timeout: timeoutInMillis } : {}),
      });
      if (response.status !== 200) {
        throw new MetriportError(`HTTP request failed with status ${response.status}`, undefined, {
          status: response.status,
          statusText: response.statusText,
        });
      }
      log(`Transform completed successfully`);
    });
  }
}
