import { Database } from "sqlite3";
/* eslint-disable */

export class SqliteClient {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, err => {
      if (err) {
        console.error("Error opening database:", err);
        throw err;
      } else {
        console.log("Connected to SQLite database at:", dbPath);
      }
    });
  }

  async run(query: string, params: any[] = []): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(query, params, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async runAndReturn(query: string, params: any[] = []): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async select(query: string, params: any[] = []): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async selectOne(query: string, params: any[] = []): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}
