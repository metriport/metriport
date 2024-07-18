import httpStatus from "http-status";
import { MetriportError } from "./metriport-error";

const numericStatus = httpStatus.BAD_REQUEST;

/**
 * @deprecated User @metriport/shared instead
 */
export default class BadRequestError extends MetriportError {
  constructor(
    message = "Unexpected issue with the request - check inputs and try again",
    cause?: unknown,
    additionalInfo?: Record<string, string | number | undefined | null>
  ) {
    super(message, cause, additionalInfo);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
