import { MetriportError } from "@metriport/shared";
import { ConsumerHealthDataType } from "../providers/provider";

export default class UnsupportedDataTypeError extends MetriportError {
  constructor(providerName: string, dataType: ConsumerHealthDataType) {
    super(`Provider ${providerName} does not support the data type ${dataType}`);
    this.name = this.constructor.name;
  }
}
