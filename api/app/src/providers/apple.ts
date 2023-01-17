import Provider, { ConsumerHealthDataType } from "./provider";

export class Apple extends Provider {
  constructor() {
    super({
      // All disabled for synchronous mode
      [ConsumerHealthDataType.Activity]: false,
      [ConsumerHealthDataType.Body]: false,
      [ConsumerHealthDataType.Biometrics]: false,
      [ConsumerHealthDataType.Nutrition]: false,
      [ConsumerHealthDataType.Sleep]: false,
      [ConsumerHealthDataType.User]: false,
    });
  }
}
