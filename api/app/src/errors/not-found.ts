import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.NOT_FOUND;

export default class NotFoundError extends MetriportError {
  constructor(message = httpStatus[numericStatus].toString()) {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
