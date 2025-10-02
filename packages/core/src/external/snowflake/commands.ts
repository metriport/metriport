import * as snowflake from "snowflake-sdk";

export function promisifyConnect(s: snowflake.Connection) {
  return function (): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
      s.connect((error: unknown, result: snowflake.Connection) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  };
}

export function promisifyDestroy(s: snowflake.Connection) {
  return function (): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
      s.destroy((error: unknown, result: snowflake.Connection) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  };
}

export function promisifyExecute(s: snowflake.Connection) {
  return function (sqlText: string): Promise<{
    statement: snowflake.RowStatement;
    rows: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  }> {
    return new Promise((resolve, reject) => {
      s.execute({
        sqlText,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        complete: (error: unknown, statement: snowflake.RowStatement, rows: any[] | undefined) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({
            statement,
            rows: rows || undefined,
          });
        },
      });
    });
  };
}
