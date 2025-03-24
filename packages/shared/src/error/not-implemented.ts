import { MetriportError } from "./metriport-error";

export class NotImplementedError extends MetriportError {
  constructor(message = `Not implemented`) {
    super(message);
    this.name = this.constructor.name;
  }
}
