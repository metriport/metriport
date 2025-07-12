import { ExecuteWithRetriesOptions, PurposeOfUse } from "@metriport/shared";

export const DEFAULT_AXIOS_TIMEOUT_SECONDS = 120;

export const defaultOnError500: OnError500Options = {
  retry: false,
  maxAttempts: 1,
  initialDelay: 0,
};

export enum APIMode {
  integration = "integration",
  production = "production",
}

export type OnError500Options = Omit<ExecuteWithRetriesOptions<unknown>, "shouldRetry"> & {
  retry: boolean;
};

export interface CommonWellOptions {
  /** Connection timeout in milliseconds. */
  timeout?: number;
  /** Parameters for handling internal server errors (status code 500). */
  onError500?: OnError500Options;
}

/**
 * @see https://www.commonwellalliance.org/specification/
 */
export type BaseRequestMetadata = {
  /**
   * The practitioner role of the entity making this request.
   * Valid role values: https://hl7.org/fhir/R4/valueset-practitioner-role.html
   */
  role: string;
  /**
   * The name of the user as required by HIPAA Privacy Disclosure Accounting.
   * This is NOT the patient ID.
   */
  subjectId: string;
  /** The purpose of use (POU) for this request - the reason for the request. */
  purposeOfUse: PurposeOfUse;
};
