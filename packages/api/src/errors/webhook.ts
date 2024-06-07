import { MetriportError } from "@metriport/shared";

export type WebhookErrorAddititionalInfo = {
  url: string;
  httpStatus: number;
  httpMessage?: string;
} & Record<string, string | number | undefined | null>;

export default class WebhookError extends MetriportError {
  constructor(
    message = "Unexpected error with webhook",
    override readonly cause: unknown,
    override readonly additionalInfo: WebhookErrorAddititionalInfo
  ) {
    super(message, cause, additionalInfo);
    this.name = this.constructor.name;
  }
}
