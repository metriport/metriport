import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.FORBIDDEN;

export default class ForbiddenError extends MetriportError {
  constructor(message = "Access is forbidden") {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
