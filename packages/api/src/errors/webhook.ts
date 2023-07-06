import MetriportError from "./metriport-error";

export type ErrorCause = Error & { message: string; status?: number };

export default class WebhookError extends MetriportError {
  override cause: ErrorCause;
  constructor(message = "Unexpected error with webhook", cause: ErrorCause) {
    super(message, cause);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}
