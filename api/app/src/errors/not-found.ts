import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.NOT_FOUND;

export default class NotFoundError extends MetriportError {
  constructor(message = "Could not find the requested resource", cause?: unknown) {
    super(message, cause);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
