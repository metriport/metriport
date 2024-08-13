import { Database } from "sqlite3";
import { promisify } from "util";
/* eslint-disable */

interface DbClient {
  run(query: string, params?: any[]): Promise<void>;
  runAndReturn(query: string, params?: any[]): Promise<any>;
  select(query: string, params?: any[]): Promise<any[]>;
  selectOne(query: string, params?: any[]): Promise<any>;
}

export class TermServerClient implements DbClient {
  private db: Database;
  private runAsync: (query: string, params: any[]) => Promise<void>;
  private getAsync: (query: string, params: any[]) => Promise<any>;
  private allAsync: (query: string, params: any[]) => Promise<any[]>;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, err => {
      if (err) {
        console.log(`Error opening database: ${err}`);
        throw err;
      } else {
        console.log(`Connected to SQLite database at: ${dbPath}`);
      }
    });

    this.runAsync = promisify(this.db.run.bind(this.db));
    this.getAsync = promisify(this.db.get.bind(this.db));
    this.allAsync = promisify(this.db.all.bind(this.db));
  }

  async run(query: string, params: any[] = []): Promise<void> {
    return this.runAsync(query, params);
  }

  async runAndReturn(query: string, params: any[] = []): Promise<any> {
    return this.getAsync(query, params);
  }

  async select(query: string, params: any[] = []): Promise<any[]> {
    return this.allAsync(query, params);
  }

  async selectOne(query: string, params: any[] = []): Promise<any> {
    return this.getAsync(query, params);
  }
}

export function createTermServerClient(dbPath: string): TermServerClient {
  return new TermServerClient(dbPath);
}
