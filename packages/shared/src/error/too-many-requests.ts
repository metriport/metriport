import httpStatus from "http-status";
import { MetriportError } from "./metriport-error";

const numericStatus = httpStatus.TOO_MANY_REQUESTS;

export class TooManyRequestsError extends MetriportError {
  constructor(
    message = "Too many requests - please reduce your request rate.",
    cause?: unknown,
    additionalInfo?: Record<string, string | number | undefined | null>
  ) {
    super(message, cause, additionalInfo);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
