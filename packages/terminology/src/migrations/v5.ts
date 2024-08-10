export const sql = `
    CREATE TABLE IF NOT EXISTS ConceptMap (
      id UUID NOT NULL PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      sourceCode TEXT NOT NULL,
      target TEXT NOT NULL,
      targetCode TEXT[] NOT NULL,
      UNIQUE (source, sourceCode, target)
    )`;
