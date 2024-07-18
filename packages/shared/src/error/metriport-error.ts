import status from "http-status";

export type AdditionalInfo = Record<string, string | number | undefined | null>;

export class MetriportError extends Error {
  status: number = status.INTERNAL_SERVER_ERROR;
  constructor(message: string, readonly cause?: unknown, readonly additionalInfo?: AdditionalInfo) {
    super(message);
    this.cause = cause;
  }
}
