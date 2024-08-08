import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { OperationDefinition, Coding, CodeSystem } from "@medplum/fhirtypes";
import { normalizeOperationOutcome, allOk } from "@medplum/core";
import { getSqliteClient } from "../sqlite";
import { buildOutputParameters, parseInputParameters } from "./utils/parameters";
import { findCodeSystemResource } from "./utils/terminology";

const operation: OperationDefinition = {
  resourceType: "OperationDefinition",
  name: "codesystem-import",
  status: "active",
  kind: "operation",
  code: "import",
  experimental: true,
  resource: ["CodeSystem"],
  system: false,
  type: true,
  instance: false,
  parameter: [
    { use: "in", name: "system", type: "uri", min: 0, max: "1" },
    { use: "in", name: "concept", type: "Coding", min: 0, max: "*" },
    {
      use: "in",
      name: "property",
      min: 0,
      max: "*",
      part: [
        { use: "in", name: "code", type: "code", min: 1, max: "1" },
        { use: "in", name: "property", type: "code", min: 1, max: "1" },
        { use: "in", name: "value", type: "string", min: 1, max: "1" },
      ],
    },
    { use: "out", name: "return", type: "CodeSystem", min: 1, max: "1" },
  ],
};

export type ImportedProperty = {
  code: string;
  property: string;
  value: string;
};

export type CodeSystemImportParameters = {
  system?: string;
  concept?: Coding[];
  property?: ImportedProperty[];
};

export async function codeSystemImportHandler(req: FhirRequest): Promise<FhirResponse> {
  try {
    const params = parseInputParameters<CodeSystemImportParameters>(operation, req);
    if (!params.system) {
      return [normalizeOperationOutcome(new Error("System is Required"))];
    }
    const codeSystem = await findCodeSystemResource(params.system);
    await importCodeSystemSqlite(codeSystem, params.concept);
    return [allOk, buildOutputParameters(operation, codeSystem)];
  } catch (err) {
    return [normalizeOperationOutcome(err)];
  }
}

export async function importCodeSystemSqlite(
  codeSystem: CodeSystem,
  concepts?: Coding[]
  // properties?: ImportedProperty[]
): Promise<void> {
  const db = getSqliteClient();
  if (concepts?.length) {
    const rows = uniqueOn(concepts, c => c.code ?? "").map(c => ({
      system: codeSystem.id,
      code: c.code,
      display: c.display,
    }));
    const params = rows.flatMap(row => [row.system, row.code, row.display]);
    const query = `
      INSERT INTO Coding (system, code, display)
      VALUES ${rows.map(() => "(?, ?, ?)").join(", ")}
      ON CONFLICT(system, code) DO UPDATE SET display=excluded.display
    `;
    await db.run(query, params);
  }

  // if (properties?.length) {
  //   await processProperties(properties, codeSystem, db);
  // }
}

function uniqueOn<T>(arr: T[], keyFn: (el: T) => string): T[] {
  const seen = Object.create(null);
  for (const el of arr) {
    const key = keyFn(el);
    seen[key] = el;
  }
  return Object.values(seen);
}
