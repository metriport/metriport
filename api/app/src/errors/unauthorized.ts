import status from "http-status";
import MetriportError from "./metriport-error";

export default class UnauthorizedError extends MetriportError {
  status = status.UNAUTHORIZED;
  constructor(message = status[status.UNAUTHORIZED].toString()) {
    super(message);
    this.name = this.constructor.name;
  }
}
