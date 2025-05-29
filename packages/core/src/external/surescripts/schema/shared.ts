import { convertDateToString, convertDateToTimeString } from "@metriport/shared/common/date";
import { MetriportError } from "@metriport/shared";
import dayjs from "dayjs";

// Describes a single field mapping from an object to a row in a pipe-delimited file
interface FileField<T extends object, K extends keyof T = keyof T> {
  field: number;
  key?: K;
  description?: string;
  leaveEmpty?: boolean;
}

// Fields of outgoing files have a toSurescripts function
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

// Fields of incoming files have a defined fromSurescripts function defined
export interface IncomingFileSchema<H extends object, D extends object, F extends object> {
  header: IncomingFileRowSchema<H>;
  detail: IncomingFileRowSchema<D>;
  footer: IncomingFileRowSchema<F>;
}

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
  return function (value: string): FieldTypeFromSurescripts<T, O> {
    if (enumerated.includes(value as T)) {
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

export function toSurescriptsString<T extends object>(key: keyof T, option: FieldOption = {}) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "string") {
      return value.replace(/\|/g, "\\F\\");
    } else if (option.optional && value == null) {
      return "";
    } else {
      throw new MetriportError(`Invalid value: ${value}`, "to_surescripts_string", {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function fromSurescriptsString<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromSurescripts<string, O> {
    const pipeUnescaped = value.replace(/\\F\\/g, "|").trim();
    if (option.optional && pipeUnescaped.length === 0) {
      return undefined as FieldTypeFromSurescripts<string, O>;
    } else {
      return pipeUnescaped;
    }
  };
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
    const year = value.substring(0, 4);
    const month = value.substring(4, 6);
    const day = value.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
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
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function fromSurescriptsUtcDate<O extends FieldOption>({
  useUtc = false,
}: { useUtc?: boolean } = {}) {
  return function (value: string): FieldTypeFromSurescripts<Date, O> {
    const date = dayjs(value);
    if (!date.isValid()) {
      throw new Error(`Invalid date: ${value}`);
    }
    return (useUtc ? date.utc() : date.local()).toDate();
  };
}

export function fromSurescriptsTime({ centisecond = true }: { centisecond?: boolean } = {}) {
  return function (value: string): Date {
    if (value.length !== 6 + (centisecond ? 2 : 0)) {
      throw new Error(`Invalid time: ${value}`);
    }
    return dayjs(value, "HHmmssSS").toDate();
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
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function fromSurescriptsInteger<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromSurescripts<number, O> {
    if (value.trim() === "") {
      if (option.optional) {
        return undefined as FieldTypeFromSurescripts<number, O>;
      } else {
        throw new Error(`Missing required field`);
      }
    }

    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    } else {
      throw new Error(`Invalid integer: ${value}`);
    }
  };
}

export function toSurescriptsInteger<T extends object>(
  key: keyof T,
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "number" && isFinite(value)) {
      return value.toFixed(0);
    } else if (optional && value == null) {
      return "";
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}
