import status from "http-status";

/**
 * @deprecated Use @metriport/core instead
 */
export default class MetriportError extends Error {
  status: number = status.INTERNAL_SERVER_ERROR;
  constructor(
    message: string,
    cause?: unknown,
    readonly additionalInfo?: Record<string, string | number | boolean | undefined | null>
  ) {
    super(message);
    this.cause = cause;
  }
}
