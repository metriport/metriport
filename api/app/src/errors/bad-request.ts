import status from "http-status";
import MetriportError from "./metriport-error";

export default class BadRequestError extends MetriportError {
  status = status.BAD_REQUEST;
  constructor(message = status[status.BAD_REQUEST].toString()) {
    super(message);
    this.name = this.constructor.name;
  }
}
