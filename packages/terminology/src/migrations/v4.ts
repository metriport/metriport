export const sql = `CREATE TABLE IF NOT EXISTS Coding_Property (
    coding INTEGER NOT NULL,
    property INTEGER NOT NULL, 
    target INTEGER, 
    value TEXT,
    FOREIGN KEY (coding) REFERENCES Coding(id),
    FOREIGN KEY (property) REFERENCES CodeSystem_Property(id),
    FOREIGN KEY (target) REFERENCES Coding(id)
    UNIQUE (coding, property)
);`;
