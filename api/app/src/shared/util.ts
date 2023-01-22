import { mean } from "lodash";

interface MinMaxItem {
  min_item: number;
  max_item: number;
}
export class Util {
  static curSecSinceEpoch(): number {
    const now = new Date();
    const utcMilllisecondsSinceEpoch = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    return Math.round(utcMilllisecondsSinceEpoch / 1000);
  }

  static getMinMaxItem = (arr: number[]): MinMaxItem => {
    const min_item = Math.min(...arr);
    const max_item = Math.max(...arr);

    return {
      min_item,
      max_item,
    };
  };

  static getAvgOfArr = (arr: number[]): number => {
    if (arr.length) {
      const average = mean(arr);
      return Number(average.toFixed(0));
    }

    return 0;
  };

  static addDataToObject = (key: string, value: unknown) => {
    if (value) {
      return { [key]: value };
    }
    return undefined;
  };

  static log =
    (prefix: string) =>
    (msg: string, err?: unknown): void =>
      err ? console.log(`[${prefix}] ${msg}`, err) : console.log(`[${prefix}] ${msg}`);

  static sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));

  static kilojoulesToKilocalories(kilojoules: number): number {
    return kilojoules * 0.239006;
  }

  /**
   * Converts the parameter to undefined if its null, or return
   * it if present.
   * The return type is the original or undefined, can't return null.
   */
  static optional = <T>(v: T): NonNullable<T> | undefined => (v != null ? v : undefined);

  /**
   * Returns the first non-null and non-undefined item in the array,
   * or undefined.
   */
  static oneOf = <T>(...values: T[]): NonNullable<T> | undefined =>
    values.find(v => v != null) ?? undefined;
}
