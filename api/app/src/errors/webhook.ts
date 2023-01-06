import status from "http-status";
import MetriportError from "./metriport-error";

export default class WebhookError extends MetriportError {
  status = status.INTERNAL_SERVER_ERROR;
  underlyingError: { message: string };
  constructor(
    message = status[status.INTERNAL_SERVER_ERROR].toString(),
    underlyingError: { message: string }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.underlyingError = underlyingError;
  }
}
