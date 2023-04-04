import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.PRECONDITION_FAILED;

export default class VersionMismatchError extends MetriportError {
  readonly status = numericStatus;
  constructor(message = httpStatus[numericStatus].toString()) {
    super(message);
    this.name = this.constructor.name;
  }
}
