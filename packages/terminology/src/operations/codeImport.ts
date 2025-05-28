import { OperationOutcomeError, allOk, badRequest, normalizeOperationOutcome } from "@medplum/core";
import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { CodeSystem, Coding, OperationDefinition } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { getTermServerClient } from "../init-term-server";
import { findCodeSystemResource, parentProperty } from "./utils/codeSystemLookup";
import { parseInputParameters } from "./utils/parameters";

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

export async function codeSystemImportHandler(
  req: FhirRequest,
  isOverwrite: boolean
): Promise<FhirResponse> {
  try {
    const params = parseInputParameters(operation, req);
    if (!params.system) {
      return [normalizeOperationOutcome(new Error("System is Required"))];
    }
    const codeSystem = await findCodeSystemResource(params.system);
    await importCodeSystemSqlite(codeSystem, params.concept, params.property, isOverwrite);
    return [allOk];
  } catch (err) {
    return [normalizeOperationOutcome(err)];
  }
}

export async function importCodeSystemSqlite(
  codeSystem: CodeSystem,
  concepts?: Coding[],
  properties?: ImportedProperty[],
  isOverwrite?: boolean
): Promise<void> {
  const db = getTermServerClient();
  if (concepts?.length) {
    const rows = uniqueOn(concepts, c => c.code ?? "").map(c => ({
      system: codeSystem.id,
      code: c.code,
      display: c.display,
    }));
    const params = rows.flatMap(row => [row.system, row.code, row.display]);
    const onConflict = isOverwrite ? "DO UPDATE SET display = excluded.display" : "DO NOTHING";
    const query = `INSERT INTO coding (system, code, display)
      VALUES ${rows.map(() => "(?, ?, ?)").join(", ")}
      ON CONFLICT(system, code) ${onConflict}`;

    await db.run(query, params);
  }

  if (properties?.length) {
    await processProperties(properties, codeSystem);
  }
}

function uniqueOn<T>(arr: T[], keyFn: (el: T) => string): T[] {
  const seen = Object.create(null);
  for (const el of arr) {
    const key = keyFn(el);
    seen[key] = el;
  }
  return Object.values(seen);
}

async function processProperties(
  importedProperties: ImportedProperty[],
  codeSystem: CodeSystem
): Promise<void> {
  const cache: Record<string, { id: number; isRelationship: boolean }> = Object.create(null);
  const rows = [];
  const db = getTermServerClient();

  for (const imported of importedProperties) {
    const propertyCode = imported.property;
    const cacheKey = codeSystem.url + "|" + propertyCode;
    let { id: propId, isRelationship } = cache[cacheKey] ?? {};
    if (!propId) {
      [propId, isRelationship] = await resolveProperty(codeSystem, propertyCode);
      cache[cacheKey] = { id: propId, isRelationship };
    }

    const lookupCodes = isRelationship ? [imported.code, imported.value] : [imported.code];

    const placeholders = lookupCodes.map(() => "?").join(",");
    const query = `SELECT id, code FROM coding WHERE system = ? AND code IN (${placeholders})`;
    const params = [codeSystem.id, ...lookupCodes];
    const codingIds = await db.select(query, params);

    const sourceCodingId = codingIds.find(r => r.code === imported.code)?.id;
    if (!sourceCodingId) {
      throw new OperationOutcomeError(
        badRequest(`Unknown code: ${codeSystem.url}|${imported.code}`)
      );
    }

    const targetCodingId = codingIds.find(r => r.code === imported.value)?.id;
    //eslint-disable-next-line
    const property: Record<string, any> = {
      coding: sourceCodingId,
      property: propId,
      value: imported.value,
      target: isRelationship && targetCodingId ? targetCodingId : null,
    };

    rows.push(property);
  }

  const insertQuery = `
    INSERT INTO coding_property (coding, property, value, target)
    VALUES ${rows.map(() => "(?, ?, ?, ?)").join(", ")}
    ON CONFLICT(coding, property) DO UPDATE SET value=excluded.value, target=excluded.target
  `;
  const params = rows.flatMap(row => [row.coding, row.property, row.value, row.target]);
  await db.run(insertQuery, params);
}

async function resolveProperty(codeSystem: CodeSystem, code: string): Promise<[number, boolean]> {
  let prop = codeSystem.property?.find(p => p.code === code);
  if (!prop) {
    if (
      code === codeSystem.hierarchyMeaning ||
      (code === "parent" && !codeSystem.hierarchyMeaning)
    ) {
      prop = { code, uri: parentProperty, type: "code" };
    } else {
      throw new OperationOutcomeError(badRequest(`Unknown property: ${code}`));
    }
  }
  const isRelationship = prop.type === "code";

  const db = getTermServerClient();
  const selectQuery = 'SELECT id FROM code_system_property WHERE "system" = ? AND "code" = ?';
  const knownProp = await db.selectOne(selectQuery, [codeSystem.id, code]);
  if (knownProp) {
    return [knownProp.id, isRelationship];
  }

  const uuid = uuidv4();
  const insertQuery =
    'INSERT INTO code_system_property ("id", "system", "code", "type", "uri", "description") VALUES (?, ?, ?, ?, ?, ?) RETURNING "id"';
  const newProp = await db.runAndReturn(insertQuery, [
    uuid,
    codeSystem.id,
    code,
    prop.type,
    prop.uri,
    prop.description,
  ]);
  return [newProp.id, isRelationship];
}
