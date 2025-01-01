import status from "http-status";

/**
 * @deprecated User @metriport/shared instead
 */
export type AdditionalInfo = Record<string, string | number | undefined | null>;

/**
 * @deprecated User @metriport/shared instead
 */
export class MetriportError extends Error {
  status: number = status.INTERNAL_SERVER_ERROR;
  constructor(message: string, readonly cause?: unknown, readonly additionalInfo?: AdditionalInfo) {
    super(message);
    this.cause = cause;
  }
}
