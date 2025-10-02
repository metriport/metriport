export type StartFhirToCsvTransformRequest = {
  cxId: string;
  patientId: string;
  outputPrefix: string;
  /**
   * How long can it wait for the response from the transform lambda before it fails.
   * Important so we are able to fail the processing in a lambda before the lambda's process
   * gets killed - and then we don't handle the error.
   */
  timeoutInMillis?: number | undefined;
};

/**
 * Represents the request body for the transform lambda.
 *
 * Careful when editing this, there's no shared type with the Pyhon code.
 * See packages/data-transformation/fhir-to-csv/main.py
 */
export type FhirToCsvTransformServiceRequest = {
  CX_ID: string;
  PATIENT_ID: string;
  OUTPUT_PREFIX: string;
  INPUT_S3_BUCKET: string;
  OUTPUT_S3_BUCKET: string;
};

export interface FhirToCsvTransformHandler {
  startFhirToCsvTransform(request: StartFhirToCsvTransformRequest): Promise<void>;
}
