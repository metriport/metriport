import httpStatus from "http-status";
import MetriportError from "./metriport-error";

const numericStatus = httpStatus.NOT_FOUND;

export default class NotFoundError extends MetriportError {
  constructor(message: string) {
    super(message);
    this.status = numericStatus;
    this.name = this.constructor.name;
  }
}
