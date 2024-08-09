import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";

// TODO MAKE THIS USE CLIENT
export async function lookupCode(system: string, code: string) {
  const response = await axios.post(
    "http://127.0.0.1:3000/fhir/R4/CodeSystem/lookup",
    {
      resourceType: "Parameters",
      parameter: [
        { name: "system", valueUri: system },
        { name: "code", valueCode: code },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function importConcepts(system: string) {
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
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function main() {
  try {
    // Import example
    const importResult = await importConcepts("http://snomed.info/sct");
    console.log("Import Result:", JSON.stringify(importResult, null, 2));

    // Lookup example
    const lookupResult = await lookupCode("http://hl7.org/fhir/sid/icd-10-cm", "W61.42");
    console.log("Lookup Result:", JSON.stringify(lookupResult, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
