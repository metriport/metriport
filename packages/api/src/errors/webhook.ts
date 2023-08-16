import MetriportError from "./metriport-error";

export type ErrorCause = Error & { message: string; status?: number };

export default class WebhookError extends MetriportError {
  constructor(
    message = "Unexpected error with webhook",
    cause?: unknown,
    additionalInfo?: Record<string, string | undefined | null>
  ) {
    super(message, cause, additionalInfo);
    this.name = this.constructor.name;
  }
}
