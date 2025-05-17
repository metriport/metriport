// Wraps an SFTP file operation with a schema for each line of the generated file.
export type FileFieldSchema<T extends object> = {
  [K in keyof T]: FileField<T, K>;
}[keyof T][];

// Describes a single field for a row in a generated file.
export interface FileField<T extends object, K extends keyof T = keyof T> {
  field: number;
  key?: K;
  toSurescripts?: (row: T) => string;
  fromSurescripts?: (value: string) => T[K];
  description?: string;
  leaveEmpty?: boolean;
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
