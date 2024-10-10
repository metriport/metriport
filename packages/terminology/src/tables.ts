export const tables = [
  `
    CREATE TABLE IF NOT EXISTS code_system (
      id UUID NOT NULL PRIMARY KEY,
      content TEXT NOT NULL,
      system TEXT NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS coding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      system UUID NOT NULL,
      display TEXT,
      UNIQUE(system, code),
      FOREIGN KEY (system) REFERENCES code_system(id)
    );
  `,
  `CREATE TABLE IF NOT EXISTS "code_system_property" (
        id UUID PRIMARY KEY,
        system UUID NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        uri TEXT,
        description TEXT,
        FOREIGN KEY (system) REFERENCES code_system(id)
    );`,
  `CREATE TABLE IF NOT EXISTS coding_property (
        coding INTEGER NOT NULL,
        property INTEGER NOT NULL, 
        target INTEGER, 
        value TEXT,
        FOREIGN KEY (coding) REFERENCES coding(id),
        FOREIGN KEY (property) REFERENCES code_system_property(id),
        FOREIGN KEY (target) REFERENCES coding(id)
        UNIQUE (coding, property)
    );`,
  `
    CREATE TABLE IF NOT EXISTS concept_map (
      id UUID NOT NULL PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      sourceCode TEXT NOT NULL,
      target TEXT NOT NULL,
      targetCode TEXT[] NOT NULL,
      UNIQUE (source, sourceCode, target)
    )`,
];
