export const sql = `CREATE TABLE IF NOT EXISTS "CodeSystem_Property" (
    id BIGSERIAL PRIMARY KEY,
    system UUID NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    uri TEXT,
    description TEXT,
    FOREIGN KEY (system) REFERENCES CodeSystem(id)
  )`;
