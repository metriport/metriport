import { CqlParameters, ExecutionMode } from "@metriport/shared/domain/cql-engine/transform";

export type InvokeHedisCliRequest = {
  patientBundleS3Key: string;
  measureName: string;
  outputMeasureReportS3Path: string;
  mode?: ExecutionMode;
  parameters?: CqlParameters;
  /**
   * How long can it wait for the response from the transform lambda before it fails.
   * Important so we are able to fail the processing in a lambda before the lambda's process
   * gets killed - and then we don't handle the error.
   */
  timeoutInMillis?: number;
};

/**
 * Represents the request body for the transform lambda.
 *
 */
export type InvokeHedisCliServiceRequest = {
  patientBundleS3Key: string;
  measureName: string;
  outputMeasureReportS3Path: string;
  mode: ExecutionMode;
  parameters: CqlParameters;
};

export interface HedisCliHandler {
  invokeHedisCli(request: InvokeHedisCliRequest): Promise<void>;
}
