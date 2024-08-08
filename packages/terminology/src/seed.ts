import { CodeSystem } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { cpt, cvx, icd10cm, icd10pcs, loinc, rxnorm, snomed } from "./codeSystem";
import { SqliteClient } from "./sqlClient";

type UmlsSource = { system: string; resource: CodeSystem };
const umlsSources: Record<string, UmlsSource> = {
  SNOMEDCT_US: { system: "http://snomed.info/sct", resource: snomed },
  LNC: { system: "http://loinc.org", resource: loinc },
  RXNORM: {
    system: "http://www.nlm.nih.gov/research/umls/rxnorm",
    resource: rxnorm,
  },
  CPT: { system: "http://www.ama-assn.org/go/cpt", resource: cpt },
  CVX: { system: "http://hl7.org/fhir/sid/cvx", resource: cvx },
  ICD10PCS: { system: "http://hl7.org/fhir/sid/icd-10-pcs", resource: icd10pcs },
  ICD10CM: { system: "http://hl7.org/fhir/sid/icd-10-cm", resource: icd10cm },
};

export async function seedCodeSystems(client: SqliteClient): Promise<void> {
  for (const source of Object.values(umlsSources)) {
    const result = await client.selectOne('SELECT "id" FROM "CodeSystem" WHERE "system" = ?', [
      source.system,
    ]);

    if (result) {
      console.log("CodeSystem already exists", result);
    } else {
      const uuid = uuidv4();
      const resource = { ...source.resource, id: uuid };
      await client.run('INSERT INTO "CodeSystem" ("id", "system", "content") VALUES (?, ?, ?)', [
        uuid,
        source.system,
        JSON.stringify(resource),
      ]);
    }
  }
}
