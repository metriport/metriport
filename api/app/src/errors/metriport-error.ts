import status from "http-status";

export default class MetriportError extends Error {
  status: number = status.INTERNAL_SERVER_ERROR;
  constructor(message: string, cause?: unknown, readonly additionalInfo?: Record<string, string>) {
    super(message);
    this.cause = cause;
  }
}
