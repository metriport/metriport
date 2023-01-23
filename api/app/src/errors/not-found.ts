import MetriportError from "./metriport-error";
import status from "http-status";

export default class NotFoundError extends MetriportError {
  status = status.NOT_FOUND;
  constructor(message = status[status.NOT_FOUND].toString()) {
    super(message);
    this.name = this.constructor.name;
  }
}
