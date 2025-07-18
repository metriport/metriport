import { convertDateToString, convertDateToTimeString } from "@metriport/shared/common/date";
import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";

/**
 * Describes a single field mapping from an object to a row in a pipe-delimited file
 */
interface FileField<T extends object, K extends keyof T = keyof T> {
  field: number;
  key?: K;
  description?: string;
  leaveEmpty?: boolean;
}

/**
 * Fields of outgoing files have a toSurescripts function
 */
export interface OutgoingFileSchema<H extends object, D extends object, F extends object> {
  header: OutgoingFileRowSchema<H>;
  detail: OutgoingFileRowSchema<D>;
  footer: OutgoingFileRowSchema<F>;
}

export type OutgoingFileRowSchema<T extends object> = {
  [K in keyof T]: OutgoingFileField<T, K>;
}[keyof T][];

export interface OutgoingFileField<T extends object, K extends keyof T = keyof T>
  extends FileField<T, K> {
  toSurescripts: (row: T) => string;
}

/**
 * Fields of incoming files have a defined fromSurescripts function defined
 */
export interface IncomingFileSchema<H extends object, D extends object, F extends object> {
  header: {
    row: IncomingFileRowSchema<H>;
    validator: (data: object) => data is H;
  };
  detail: {
    row: IncomingFileRowSchema<D>;
    validator: (data: object) => data is D;
  };
  footer: {
    row: IncomingFileRowSchema<F>;
    validator: (data: object) => data is F;
  };
}

/**
 * The incoming file data parsed from the schema
 */
export interface IncomingFile<H extends object, D extends object, F extends object> {
  header: IncomingData<H>;
  details: IncomingData<D>[];
  footer: IncomingData<F>;
}

export type IncomingData<T extends object> = {
  data: T;
  source: string[];
};

export type IncomingFileRowSchema<T extends object> = {
  [K in keyof T]: IncomingFileField<T, K>;
}[keyof T][];

export interface IncomingFileField<T extends object, K extends keyof T = keyof T>
  extends FileField<T, K> {
  fromSurescripts: (value: string) => T[K];
}

interface FieldOption {
  optional?: boolean;
  minLength?: number;
  maxLength?: number;
  truncate?: boolean;
}
type FieldTypeFromSurescripts<T, O extends FieldOption> = O extends { optional: true }
  ? T | undefined
  : T;

export function fromSurescriptsEnum<T extends string, O extends FieldOption>(
  enumerated: readonly T[],
  option: O = {} as O
) {
  const enumeratedSet = new Set(enumerated);
  return function (value: string): FieldTypeFromSurescripts<T, O> {
    if (enumeratedSet.has(value as T)) {
      return value as T;
    } else if (value === "" && option.optional) {
      return undefined as FieldTypeFromSurescripts<T, O>;
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "from_surescripts_enum", {
        value,
        options: enumerated.join(","),
      });
    }
  };
}

export function toSurescriptsEnum<T extends object>(
  key: keyof T,
  enumerated: string[],
  option: FieldOption = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "string" && enumerated.includes(value)) {
      return value;
    } else if (option.optional && value == null) {
      return "";
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "to_surescripts_enum", {
        value: String(value),
        options: enumerated.join(","),
      });
    }
  };
}

export function toSurescriptsString<T extends object>(
  key: keyof T,
  { optional = false, minLength = 0, maxLength = 0, truncate = false }: FieldOption = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "string") {
      if (truncate && maxLength != null && value.length > maxLength) {
        return escapePipe(value).substring(0, maxLength);
      }
      if (minLength != null && value.length < minLength) {
        if (optional) {
          return "";
        }
        throw new MetriportError(`Value is too short: ${value}`, "to_surescripts_string", {
          value: String(value),
          key: String(key),
          minLength,
        });
      }
      return escapePipe(value);
    } else if (optional && value == null) {
      return "";
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "to_surescripts_string", {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function toSurescriptsUnused() {
  return "";
}

export function fromSurescriptsString<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromSurescripts<string, O> {
    const pipeUnescaped = unescapePipe(value).trim();
    if (option.optional && pipeUnescaped.length === 0) {
      return undefined as FieldTypeFromSurescripts<string, O>;
    } else {
      return pipeUnescaped;
    }
  };
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, "\\F\\");
}

function unescapePipe(value: string): string {
  return value.replace(/\\F\\/g, "|");
}

// Surescripts limits patient ID length to 35 characters, and a UUID is 36 >:(
export function toSurescriptsUUID(value: string): string {
  return value.replace(/-/g, "");
}

export function fromSurescriptsUUID(value: string): string {
  const part1 = value.substring(0, 8);
  const part2 = value.substring(8, 12);
  const part3 = value.substring(12, 16);
  const part4 = value.substring(16, 20);
  const part5 = value.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function fromSurescriptsDate<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromSurescripts<Date, O> {
    if (value.length !== 8) {
      if (option.optional && value.length === 0) {
        return undefined as FieldTypeFromSurescripts<Date, O>;
      } else {
        throw new MetriportError(`Invalid date: ${value}`);
      }
    }
    const date = new Date();
    date.setUTCFullYear(parseInt(value.substring(0, 4), 10));
    date.setUTCMonth(parseInt(value.substring(4, 6), 10) - 1);
    date.setUTCDate(parseInt(value.substring(6, 8), 10));
    date.setUTCHours(0, 0, 0, 0);
    return date;
  };
}

export function toSurescriptsDate<T extends object>(
  key: keyof T,
  { optional = false, useUtc = true }: { optional?: boolean; useUtc?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (value instanceof Date) {
      return convertDateToString(value, { useUtc });
    } else if (typeof value === "string") {
      return value.replace(/-/g, "");
    } else if (optional && value == null) {
      return "";
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "to_surescripts_date", {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function fromSurescriptsUtcDate<O extends FieldOption>() {
  return function (value: string): FieldTypeFromSurescripts<Date, O> {
    const date = buildDayjs(value);
    if (!date.isValid()) {
      throw new MetriportError(`Invalid date: ${value}`, "from_surescripts_utc_date", {
        value,
      });
    }
    return date.toDate();
  };
}

export function fromSurescriptsTime({ centisecond = true }: { centisecond?: boolean } = {}) {
  return function (value: string): Date {
    if (value.length !== 6 + (centisecond ? 2 : 0)) {
      throw new MetriportError(`Invalid time: ${value}`, "from_surescripts_time", {
        value,
      });
    }
    const date = new Date();
    date.setHours(parseInt(value.substring(0, 2), 10));
    date.setMinutes(parseInt(value.substring(2, 4), 10));
    date.setSeconds(parseInt(value.substring(4, 6), 10));
    date.setMilliseconds(centisecond ? parseInt(value.substring(6, 8), 10) * 10 : 0);
    return date;
  };
}

export function toSurescriptsTime<T extends object>(
  key: keyof T,
  { centisecond = false, optional = false }: { centisecond?: boolean; optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (value instanceof Date) {
      return convertDateToTimeString(value, { includeCentisecond: centisecond });
    } else if (optional && value == null) {
      return "";
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "to_surescripts_time", {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function fromSurescriptsInteger<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromSurescripts<number, O> {
    if (value.trim() === "") {
      if (option.optional) {
        return undefined as FieldTypeFromSurescripts<number, O>;
      } else {
        throw new MetriportError(`Missing required field`, "from_surescripts_integer", {
          value,
        });
      }
    }

    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    } else {
      throw new MetriportError(`Invalid integer: ${value}`, "from_surescripts_integer", {
        value,
      });
    }
  };
}

export function toSurescriptsInteger<T extends object>(
  key: keyof T,
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toFixed(0);
    } else if (optional && value == null) {
      return "";
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "to_surescripts_integer", {
        value: String(value),
        key: String(key),
      });
    }
  };
}
