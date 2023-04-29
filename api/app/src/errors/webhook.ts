import MetriportError from "./metriport-error";

export default class WebhookError extends MetriportError {
  underlyingError: { message: string };
  constructor(message: string, underlyingError: { message: string }) {
    super(message);
    this.name = this.constructor.name;
    this.underlyingError = underlyingError;
  }
}
