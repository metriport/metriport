import { faker } from "@faker-js/faker";
import { Composition } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeComposition(
  ids?: { encId: string; practId: string },
  params: Partial<Composition> = {}
): Composition {
  const encounterId = ids?.encId ?? faker.string.uuid();

  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "Composition",
    status: "final",
    type: {
      coding: [
        {
          code: "11506-3",
          display: "Subsequent evaluation note",
          system: "http://loinc.org",
        },
      ],
    },
    date: "2024-03-06T21:22:21.000Z",
    title: "Encounter Summary",
    section: [
      {
        title: "Results",
        text: {
          status: "generated",
          div: '<div xmlns="http://www.w3.org/1999/xhtml">Results</div>',
        },
        mode: "snapshot",
        entry: [
          {
            reference: `Encounter/${encounterId}`,
            display: "Encounter 1",
          },
        ],
      },
    ],
    encounter: { reference: `Encounter/${encounterId}` },
    author: [{ reference: `Practitioner/${ids?.practId ?? faker.string.uuid()}` }],
    ...params,
  };
}
