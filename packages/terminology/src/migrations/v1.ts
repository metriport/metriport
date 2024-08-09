export const sql = `
    CREATE TABLE IF NOT EXISTS CodeSystem (
      id UUID NOT NULL PRIMARY KEY,
      content TEXT NOT NULL,
      system TEXT NOT NULL
    )`;
