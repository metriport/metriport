// Wraps an SFTP file operation with a schema for each line of the generated file.
export type FileFieldSchema<T extends object> = {
  [K in keyof T]: FileField<T, K>;
}[keyof T][];

export type OutgoingFileRowSchema<T extends object> = {
  [K in keyof T]: OutgoingFileField<T, K>;
}[keyof T][];

export type IncomingFileFieldSchema<T extends object> = {
  [K in keyof T]: IncomingFileField<T, K>;
}[keyof T][];

export type FileRowValidator<T extends object> = (row: object) => row is T;

export interface OutgoingFileSchema<H extends object, D extends object, F extends object> {
  header: OutgoingFileRowSchema<H>;
  detail: OutgoingFileRowSchema<D>;
  footer: OutgoingFileRowSchema<F>;
}

export interface FileValidator<H extends object, D extends object, F extends object> {
  header: FileRowValidator<H>;
  detail: FileRowValidator<D>;
  footer: FileRowValidator<F>;
}

// Describes a single field for a row in a generated file.
export interface FileField<T extends object, K extends keyof T = keyof T> {
  field: number;
  key?: K;
  toSurescripts?: (row: T) => string;
  fromSurescripts?: (value: string) => T[K];
  description?: string;
  leaveEmpty?: boolean;
}

export interface OutgoingFileField<T extends object, K extends keyof T = keyof T>
  extends FileField<T, K> {
  toSurescripts: (row: T) => string;
}
export interface IncomingFileField<T extends object, K extends keyof T = keyof T>
  extends FileField<T, K> {
  fromSurescripts: (value: string) => T[K];
}

export function dateToString(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const dateOfMonth = date.getDate().toString().padStart(2, "0");
  return [year, month, dateOfMonth].join("");
}

export function dateToTimeString(date: Date, includeCentisecond = false) {
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  const second = date.getSeconds().toString().padStart(2, "0");

  if (includeCentisecond) {
    const centisecond = Math.round(date.getMilliseconds() / 10)
      .toString()
      .padStart(2, "0");
    return [hour, minute, second, centisecond].join("");
  } else {
    return [hour, minute, second].join("");
  }
}

export function fromSurescriptsEnum<T extends string>(enumerated: T[]) {
  return function (value: string): T {
    if (enumerated.includes(value as T)) {
      return value as T;
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function toSurescriptsEnum<T extends object>(
  key: keyof T,
  enumerated: string[],
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "string" && enumerated.includes(value)) {
      return value;
    } else if (optional && value == null) {
      return "";
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function toSurescriptsString<T extends object>(
  key: keyof T,
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (typeof value === "string") {
      return value.replace(/\|/g, "\\F\\");
    } else if (optional && value == null) {
      return "";
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}
export function fromSurescriptsString() {
  return function (value: string): string {
    return value.replace(/\\F\\/g, "|");
  };
}

export function toSurescriptsArray<T extends object>(
  key: keyof T,
  enumerated: string[],
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (Array.isArray(value)) {
      return value.filter(item => enumerated.includes(item)).join(",");
    } else if (optional && value == null) {
      return "";
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function toSurescriptsDate<T extends object>(
  key: keyof T,
  { optional = false }: { optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (value instanceof Date) {
      return dateToString(value);
    } else if (optional && value == null) {
      return "";
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function toSurescriptsTime<T extends object>(
  key: keyof T,
  { centisecond = false, optional = false }: { centisecond?: boolean; optional?: boolean } = {}
) {
  return function (sourceObject: T): string {
    const value = sourceObject[key];
    if (value instanceof Date) {
      return dateToTimeString(value, centisecond);
    } else if (optional && value == null) {
      return "";
    } else {
      throw new Error(`Invalid value: ${value}`);
    }
  };
}

export function fromSurescriptsInteger(value: string): number | undefined {
  if (value.trim() === "") return undefined;

  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  } else {
    return undefined;
  }
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
