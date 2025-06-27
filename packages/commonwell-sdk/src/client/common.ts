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
  timeout?: number;
  onError500?: OnError500Options;
}

export type BaseRequestMetadata = {
  role: string;
  subjectId: string;
  purposeOfUse: PurposeOfUse;
  payloadHash?: string;
};
