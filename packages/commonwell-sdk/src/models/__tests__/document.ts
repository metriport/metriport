import { faker } from "@faker-js/faker";
import { DeepPartial } from "ts-essentials";
import { CodeableConcept, Document, DocumentIdentifier } from "../document";
import { Period } from "../period";

export function makeDocument(
  params?: DeepPartial<Document> & {
    content?: {
      contained?: {
        identifier?: DocumentIdentifier[];
      }[];
      masterIdentifier?: DocumentIdentifier;
      identifier?: DocumentIdentifier[];
      type?: CodeableConcept;
      author?: { reference: string }[];
      context?: {
        event?: CodeableConcept[];
        period?: Period;
        facilityType?: CodeableConcept;
      };
    };
  }
): Document {
  const id = params?.id ?? faker.string.uuid();
  const containedOrgId = faker.string.nanoid();
  const containedPractionerId = faker.string.nanoid();
  const content = params?.content;
  const from = faker.date.past({ years: 5 });
  const to = faker.date.between({ from, to: faker.date.recent() });
  return {
    id,
    content: {
      resourceType: "DocumentReference",
      contained: content?.contained ?? [
        {
          resourceType: "Organization",
          id: containedOrgId,
          identifier: [
            {
              value: faker.number.int({ min: 1000, max: 99999 }).toString(),
            },
          ],
          name: faker.company.name(),
        },
        {
          resourceType: "Practitioner",
          id: containedPractionerId,
          name: {
            family: [faker.person.lastName()],
            given: [faker.person.firstName()],
            prefix: [""],
          },
          organization: {
            reference: `#${containedOrgId}`,
          },
        },
      ],
      masterIdentifier: content?.masterIdentifier ?? {
        system: "urn:ietf:rfc:3986",
        value: faker.string.uuid(),
      },
      identifier: content?.identifier ?? [
        {
          use: "official",
          system: "urn:ietf:rfc:3986",
          value: `urn:uuid:${faker.string.uuid()}`,
        },
      ],
      status: content?.status ?? "current",
      type: content?.type ?? {
        coding: [
          {
            system: "http://loinc.org",
            code: "34133-9",
            display: "Summary of episode note",
          },
        ],
        text: "Summary of episode note",
      },
      subject: {
        reference: content?.subject?.reference ?? `Patient/${faker.string.uuid()}`,
      },
      author: content?.author ?? [
        {
          reference: `Practitioner/${containedPractionerId}`,
        },
      ],
      indexed: faker.date.past().toISOString(),
      context: content?.context ?? {
        event: [
          {
            text: "Ambulatory",
          },
        ],
        period: {
          start: from.toISOString(),
          end: to.toISOString(),
        },
        facilityType: {
          text: faker.company.name(),
        },
      },
    },
  };
}
