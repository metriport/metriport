import httpStatus from "http-status";
import MetriportError from "./metriport-error";

export default class WebhookError extends MetriportError {
  underlyingError: { message: string };
  constructor(
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR].toString(),
    underlyingError: { message: string }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.underlyingError = underlyingError;
  }
}
