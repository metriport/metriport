import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.PRECONDITION_FAILED;

export default class VersionMismatchError extends MetriportError {
  constructor(message = httpStatus[numericStatus].toString()) {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
