import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.UNAUTHORIZED;

export default class UnauthorizedError extends MetriportError {
  constructor(message = httpStatus[numericStatus].toString()) {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
