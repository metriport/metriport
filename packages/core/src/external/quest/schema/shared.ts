import { MetriportError } from "@metriport/shared";
import { convertDateToString } from "@metriport/shared/common/date";

/**
 * Describes a single field mapping from an object to a column in a space-padded
 */
interface FileField<T extends object, K extends keyof T = keyof T> {
  field: number; // 1 indexed to match specification
  length: number; // in bytes
  key?: K;
  description?: string;
  leaveEmpty?: boolean;
}

interface FieldOption {
  optional?: boolean;
  minLength?: number;
  truncate?: boolean;
  defaultValue?: string;
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

type ConvertFieldToQuest<T> = (row: T, byteLength: number) => string;
export interface OutgoingFileField<T extends object, K extends keyof T = keyof T>
  extends FileField<T, K> {
  toQuest: ConvertFieldToQuest<T>;
}

/**
 * Fields of incoming files have a defined fromSurescripts function defined
 */
export interface IncomingFileSchema<H extends object, D extends object, F extends object> {
  header: IncomingFileRowSchema<H>;
  detail: IncomingFileRowSchema<D>;
  footer: IncomingFileRowSchema<F>;
}

/**
 * The incoming file data parsed from the schema
 */
export interface IncomingFile<H extends object, D extends object, F extends object> {
  header: H;
  detail: D[];
  footer: F;
}

export type IncomingFileRowSchema<T extends object> = {
  [K in keyof T]: IncomingFileField<T, K>;
}[keyof T][];

// Assumes the value has already been trimmed of extra whitespace
type ConvertFieldFromQuest<T, K extends keyof T, O extends FieldOption> = (
  value: string
) => FieldTypeFromQuest<T[K], O>;
export interface IncomingFileField<
  T extends object,
  K extends keyof T,
  O extends FieldOption = FieldOption
> extends FileField<T, K> {
  fromQuest: ConvertFieldFromQuest<T, K, O>;
}

type FieldTypeFromQuest<T, O extends FieldOption> = O extends { optional: true }
  ? T | undefined
  : T;

// UTILITY FUNCTIONS
// For reusable toQuest and fromQuest implementations in the file schema

function fillEmptyByteLength(byteLength: number) {
  return fillByteLength("", byteLength);
}

function fillByteLength(value: string, byteLength: number) {
  if (value.length > byteLength) value = value.substring(0, byteLength);
  return value.padEnd(byteLength, " ");
}

export function toQuestEnum<T extends object>(
  key: keyof T,
  enumerated: readonly string[],
  option: FieldOption = {}
): ConvertFieldToQuest<T> {
  return function (sourceObject: T, byteLength: number): string {
    const value = sourceObject[key];
    if (typeof value === "string" && enumerated.includes(value)) {
      return fillByteLength(value, byteLength);
    } else if (option.optional && value == null) {
      return fillEmptyByteLength(byteLength);
    } else {
      throw new MetriportError(`Invalid value: ${value}`, undefined, {
        value: String(value),
        options: enumerated.join(","),
      });
    }
  };
}

export function fromQuestEnum<T extends string, O extends FieldOption>(
  enumerated: readonly T[],
  option: O = {} as O
) {
  const enumeratedSet = new Set(enumerated);
  return function (value: string): FieldTypeFromQuest<T, O> {
    if (enumeratedSet.has(value as T)) {
      return value as T;
    } else if (value === "" && option.optional) {
      return undefined as FieldTypeFromQuest<T, O>;
    } else {
      throw new MetriportError(`Invalid value: ${value}`, undefined, {
        value,
        options: enumerated.join(","),
      });
    }
  };
}

export function toQuestUnused<T extends object>(): ConvertFieldToQuest<T> {
  return function (_: T, byteLength: number) {
    return fillEmptyByteLength(byteLength);
  };
}

export function toQuestString<T extends object>(
  key: keyof T,
  { optional = false, minLength = 0, truncate = false, defaultValue = "" }: FieldOption = {}
) {
  return function (sourceObject: T, byteLength: number): string {
    const value = sourceObject[key];
    if (typeof value === "string") {
      if (truncate && value.length > byteLength) {
        return value.substring(0, byteLength);
      }
      if (minLength != null && value.length < minLength) {
        if (optional) {
          return fillByteLength(defaultValue, byteLength);
        }
        throw new MetriportError(`Value is too short: ${value}`, undefined, {
          value: String(value),
          key: String(key),
          minLength,
        });
      }
      return fillByteLength(value, byteLength);
    } else if (optional && value == null) {
      return fillByteLength(defaultValue, byteLength);
    } else {
      throw new MetriportError(`Invalid value: ${value}`, undefined, {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function fromQuestString<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromQuest<string, O> {
    if (option.optional && value.length === 0) {
      return undefined as FieldTypeFromQuest<string, O>;
    } else {
      return value;
    }
  };
}

export function toQuestInteger<T extends object>(
  key: keyof T,
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T, byteLength: number): string {
    const value = sourceObject[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return fillByteLength(value.toFixed(0), byteLength);
    } else if (optional && value == null) {
      return fillEmptyByteLength(byteLength);
    } else {
      throw new MetriportError(`Invalid value: ${value}`, undefined, {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function fromQuestDate<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromQuest<Date, O> {
    if (value.length !== 8) {
      if (option.optional && value.length === 0) {
        return undefined as FieldTypeFromQuest<Date, O>;
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

export function toQuestDate<T extends object>(
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
      throw new MetriportError(`Invalid value: ${value}`, undefined, {
        value: String(value),
        key: String(key),
      });
    }
  };
}

export function fromQuestInteger<O extends FieldOption>(option: O = {} as O) {
  return function (value: string): FieldTypeFromQuest<number, O> {
    if (value.trim() === "") {
      if (option.optional) {
        return undefined as FieldTypeFromQuest<number, O>;
      } else {
        throw new MetriportError(`Missing required field`, undefined, {
          value,
        });
      }
    }

    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    } else {
      throw new MetriportError(`Invalid integer: ${value}`, undefined, {
        value,
      });
    }
  };
}
