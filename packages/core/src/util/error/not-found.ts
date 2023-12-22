import httpStatus from "http-status";
import { AdditionalInfo, MetriportError } from "./metriport-error";

const numericStatus = httpStatus.NOT_FOUND;

export default class NotFoundError extends MetriportError {
  constructor(
    message = "Could not find the requested resource",
    cause?: unknown,
    additionalInfo?: AdditionalInfo
  ) {
    super(message, cause, additionalInfo);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
