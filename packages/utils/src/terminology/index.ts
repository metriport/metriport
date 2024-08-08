import * as dotenv from "dotenv";
dotenv.config();

import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { MedplumClient } from "@medplum/core";

import axios from "axios";

const medplum = new MedplumClient({
  baseUrl: "http://localhost:8103",
});

const clientId = getEnvVarOrFail(`MEDPLUM_CLIENT_ID`);
const clientSecret = getEnvVarOrFail(`MEDPLUM_CLIENT_SECRET`);

export async function lookupCode(token: string, system: string, code: string) {
  const response = await axios.get("http://localhost:8103/fhir/R4/CodeSystem/$lookup", {
    params: { system, code },
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/fhir+json",
    },
  });
  return response.data;
}

async function importConcepts(token: string, system: string) {
  const response = await axios.post(
    "http://127.0.0.1:3000/fhir/R4/CodeSystem/import",
    {
      resourceType: "Parameters",
      parameter: [
        { name: "system", valueUri: system },
        {
          name: "concept",
          valueCoding: { code: "184598004", display: "Needle biopsy of brain (procedure)" },
        },
        {
          name: "concept",
          valueCoding: { code: "702707005", display: "Biopsy of head (procedure)" },
        },
        {
          name: "concept",
          valueCoding: { code: "118690002", display: "Procedure on head (procedure)" },
        },
        { name: "concept", valueCoding: { code: "71388002", display: "Procedure (procedure)" } },
        {
          name: "property",
          part: [
            { name: "code", valueCode: "184598004" },
            { name: "property", valueCode: "parent" },
            { name: "value", valueString: "702707005" },
          ],
        },
        {
          name: "property",
          part: [
            { name: "code", valueCode: "702707005" },
            { name: "property", valueCode: "parent" },
            { name: "value", valueString: "118690002" },
          ],
        },
        {
          name: "property",
          part: [
            { name: "code", valueCode: "118690002" },
            { name: "property", valueCode: "parent" },
            { name: "value", valueString: "71388002" },
          ],
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function main() {
  await medplum.startClientLogin(clientId, clientSecret);

  try {
    const token = await medplum.getAccessToken();
    if (!token) throw new Error("No token found");

    // Import example
    const importResult = await importConcepts(token, "http://snomed.info/sct");
    console.log("Import Result:", JSON.stringify(importResult, null, 2));

    // Lookup example
    // const lookupResult = await lookupCode(token, 'http://snomed.info/sct', '184598004');
    // console.log('Lookup Result:', JSON.stringify(lookupResult, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
