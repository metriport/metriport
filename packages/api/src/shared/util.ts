import { Sample } from "@metriport/api-sdk/devices/models/common/sample";
import { debug as coreDebug, log as coreLog } from "@metriport/core/util/log";
import convert from "convert-units";
import crypto from "crypto";
import { mean } from "lodash";
import { Stream } from "stream";

export interface MinMaxItem {
  min_item: number;
  max_item: number;
}

/**
 * @deprecated Let's move these to individual functions on the respective files on this folder
 */
export class Util {
  static isTokenExpired(expires_at: number): boolean {
    const bufferSeconds = 600;

    return (
      convert(expires_at).from("s").to("ms") -
        Date.now() +
        convert(bufferSeconds).from("s").to("ms") <=
      0
    );
  }

  static md5(value: string): string {
    return crypto.createHash("md5").update(value).digest("hex");
  }

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

  static getAvgOfArr = (arr: number[], fixed = 0): number => {
    if (arr.length) {
      const average = mean(arr);
      return Number(average.toFixed(fixed));
    }

    return 0;
  };

  static getAvgOfSamplesArr = (arr: Sample[], fixed = 0): number => {
    return this.getAvgOfArr(
      arr.map(sample => sample.value),
      fixed
    );
  };

  static getMinMaxSamplesItem = (arr: Sample[]): MinMaxItem => {
    return this.getMinMaxItem(arr.map(sample => sample.value));
  };

  static addDataToObject = (key: string, value: unknown) => {
    if (value) {
      return { [key]: value };
    }
    return undefined;
  };

  /**
   * @deprecated Use @metriport/core instead
   */
  static log = coreLog;
  /**
   * @deprecated Use @metriport/core instead
   */
  static debug = coreDebug;
  /**
   * @deprecated Use @metriport/core instead
   */
  static out = (prefix: string, suffix?: string) => ({
    log: Util.log(prefix, suffix),
    debug: Util.debug(prefix, suffix),
  });

  static sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));

  static async sleepRandom(max: number, multiplierMin = 0.1): Promise<void> {
    let multiplier = Math.random();
    if (multiplier < multiplierMin) multiplier += multiplierMin; // at least 10% of the max delay
    const timeToWait = Math.floor(multiplier * max);
    await Util.sleep(timeToWait);
  }

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

  static async streamToString(stream: Stream): Promise<{ contents: string; size: number }> {
    const chunks: Buffer[] = [];
    let size = 0;
    return new Promise((resolve, reject) => {
      stream.on("data", chunk => {
        const chunkBuffer = Buffer.from(chunk);
        chunks.push(chunkBuffer);
        size += chunkBuffer.length;
      });
      stream.on("error", err => reject(err));
      stream.on("end", () => resolve({ contents: Buffer.concat(chunks).toString("utf8"), size }));
    });
  }
}
