export const sql = `
    CREATE TABLE IF NOT EXISTS Coding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      system UUID NOT NULL,
      display TEXT
    )`;
