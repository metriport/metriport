import * as httpStatus from "http-status";

export default class MetriportError extends Error {
  status: number;
  constructor(message: string, status: number = httpStatus.INTERNAL_SERVER_ERROR) {
    super(message);
    this.status = status;
  }
}
