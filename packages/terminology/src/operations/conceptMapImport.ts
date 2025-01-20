import { FhirRequest, FhirResponse } from "@medplum/fhir-router";
import { ConceptMap } from "@medplum/fhirtypes";
import { normalizeOperationOutcome } from "@medplum/core";
import { v4 as uuidv4 } from "uuid";

import { getTermServerClient } from "../init-term-server";

function generateReverseConceptMaps(conceptMap: ConceptMap): ConceptMap[] {
  const reverseMaps: ConceptMap[] = [];
  const sourceSystem = conceptMap.group?.[0]?.source;
  const targetSystem = conceptMap.group?.[0]?.target;
  const sourceCode = conceptMap.group?.[0]?.element?.[0]?.code;
  const targets = conceptMap.group?.[0]?.element?.[0]?.target;
  const sourceDisplay = conceptMap.group?.[0]?.element?.[0]?.display;

  if (!sourceSystem || !targetSystem || !sourceCode || !targets) {
    return [];
  }

  for (const target of targets) {
    const targetDisplay = target.display;

    const reverseMap: ConceptMap = {
      resourceType: "ConceptMap",
      status: "active",
      group: [
        {
          source: targetSystem,
          target: sourceSystem,
          element: [
            {
              code: target.code,
              display: targetDisplay,
              target: [
                {
                  code: sourceCode,
                  display: sourceDisplay,
                  equivalence: targets.length === 1 ? "equivalent" : "wider",
                },
              ],
            },
          ],
        },
      ],
    };
    reverseMaps.push(reverseMap);
  }

  return reverseMaps;
}

export async function conceptMapImportHandler(
  req: FhirRequest
): Promise<FhirResponse | ConceptMap[]> {
  try {
    const conceptMap = req.body as ConceptMap;
    const reverseMaps = generateReverseConceptMaps(conceptMap);
    const allMaps = [conceptMap, ...reverseMaps];

    const dbClient = getTermServerClient();
    const query = `
      INSERT INTO "concept_map" ("id", "content", "source", "sourceCode", "target", "targetCode")
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, sourceCode, target) DO UPDATE SET
      content = json_patch(
        content,
        json('{"group":[{"element":[' || json_object(
          'code', json_extract(content, '$.group[0].element[0].code'),
          'target', (
            SELECT json_group_array(
              json_object(
                'code', value,
                'equivalence', 'narrower'
              )
            )
            FROM (
              SELECT DISTINCT value
              FROM (
                SELECT json_extract(value, '$.code') as value
                FROM json_each(json_extract(content, '$.group[0].element[0].target'))
                UNION
                SELECT json_extract(value, '$.code') as value
                FROM json_each(?)
              )
            )
          )
        ) || ']}]}')
      ),
      targetCode = (
        SELECT json_group_array(DISTINCT value)
        FROM (
          SELECT value FROM json_each(targetCode)
          UNION ALL
          SELECT value FROM json_each(?)
        )
      )
    `;

    try {
      for (const map of allMaps) {
        const targetCodes = map.group?.[0]?.element?.[0]?.target?.map(target => target.code) ?? [];
        const uuid = uuidv4();

        await dbClient.run(query, [
          uuid,
          JSON.stringify(map),
          map.group?.[0]?.source,
          map.group?.[0]?.element?.[0]?.code,
          map.group?.[0]?.target,
          JSON.stringify(targetCodes),
        ]);
      }

      return allMaps;
    } catch (error) {
      console.log(`Operation failed: ${error}`);
      throw error;
    }
  } catch (error) {
    console.log(`Error: ${error}`);
    return [normalizeOperationOutcome(error)];
  }
}
