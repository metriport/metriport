import status from "http-status";

export class MetriportError extends Error {
  status: number = status.INTERNAL_SERVER_ERROR;
  constructor(
    message: string,
    readonly cause?: unknown,
    readonly additionalInfo?: Record<string, string | number | undefined | null>
  ) {
    super(message);
    this.cause = cause;
  }
}
