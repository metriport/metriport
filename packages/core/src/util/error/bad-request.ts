import httpStatus from "http-status";
import { AdditionalInfo } from "../capture";
import { MetriportError } from "./metriport-error";

const numericStatus = httpStatus.BAD_REQUEST;

export default class BadRequestError extends MetriportError {
  constructor(
    message = "Unexpected issue with the request - check inputs and try again",
    cause?: unknown,
    additionalInfo?: AdditionalInfo
  ) {
    super(message, cause, additionalInfo);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
