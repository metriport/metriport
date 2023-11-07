import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.NOT_FOUND;

/**
 * @deprecated - use @metriport/core instead
 */
export default class NotFoundError extends MetriportError {
  constructor(
    message = "Could not find the requested resource",
    cause?: unknown,
    additionalInfo?: Record<string, string | undefined | null>
  ) {
    super(message, cause, additionalInfo);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
