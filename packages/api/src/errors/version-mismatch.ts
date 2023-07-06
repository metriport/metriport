import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.PRECONDITION_FAILED;

export default class VersionMismatchError extends MetriportError {
  constructor(message = "Version mismatch - reload the data and try again") {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
