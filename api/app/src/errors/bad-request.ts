import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.BAD_REQUEST;

export default class BadRequestError extends MetriportError {
  constructor(message = httpStatus[numericStatus].toString()) {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
