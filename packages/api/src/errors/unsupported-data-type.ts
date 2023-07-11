import { ConsumerHealthDataType } from "../providers/provider";
import MetriportError from "./metriport-error";

export default class UnsupportedDataTypeError extends MetriportError {
  constructor(providerName: string, dataType: ConsumerHealthDataType) {
    super(`Provider ${providerName} does not support the data type ${dataType}`);
    this.name = this.constructor.name;
  }
}
