import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.INTERNAL_SERVER_ERROR;

export default class ConversionError extends MetriportError {
  static prefix = ConversionError.prototype.name;
  /**
   * Clients should attempt to provide a specific error message.
   */
  constructor(
    message = `${ConversionError.prefix} - Generic`,
    cause?: unknown,
    additionalInfo?: Record<string, string>
  ) {
    super(message, cause, additionalInfo);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
