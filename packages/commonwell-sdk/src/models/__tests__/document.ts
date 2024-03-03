import { faker } from "@faker-js/faker";
import { DeepPartial } from "ts-essentials";
import { v4 as uuidv4 } from "uuid";
import {
  CodeableConcept,
  Contained,
  Document,
  DocumentContent,
  DocumentIdentifier,
} from "../document";
import { Period } from "../period";

export function makeDocument(
  params?: Partial<Pick<Document, "id">> & {
    content?: MakeDocumentContent;
  }
): Document {
  const id = params?.id ?? faker.string.uuid();
  return {
    id,
    content: makeDocumentContent(params?.content),
  };
}

type MakeDocumentContent = DeepPartial<DocumentContent> &
  Partial<{
    contained: {
      identifier?: DocumentIdentifier[];
    }[];
    masterIdentifier: DocumentIdentifier;
    identifier: DocumentIdentifier[];
    type: CodeableConcept;
    author: { reference: string }[];
    context: {
      event?: CodeableConcept[];
      period?: Period;
      facilityType?: CodeableConcept;
    };
  }>;

export function makeDocumentContent(params?: MakeDocumentContent): DocumentContent {
  const containedOrgId = faker.string.nanoid();
  const containedPractionerId = faker.string.nanoid();
  const to = faker.date.recent();
  const from = faker.date.past({ years: 5, refDate: to });
  return {
    resourceType: "DocumentReference",
    contained: params?.contained ?? [
      makeContainedOrg({ id: containedOrgId }),
      makeContainedPractitioner({
        id: containedPractionerId,
        organization: { reference: `#${containedOrgId}` },
      }),
    ],
    masterIdentifier: params?.masterIdentifier ?? {
      system: "urn:ietf:rfc:3986",
      value: faker.string.uuid(),
    },
    identifier: params?.identifier ?? [
      {
        use: "official",
        system: "urn:ietf:rfc:3986",
        value: `urn:uuid:${faker.string.uuid()}`,
      },
    ],
    status: params?.status ?? "current",
    type: params?.type ?? {
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
      reference: params?.subject?.reference ?? `Patient/${faker.string.uuid()}`,
    },
    author: params?.author ?? [
      {
        reference: `Practitioner/${containedPractionerId}`,
      },
    ],
    indexed: params?.indexed ?? faker.date.past().toISOString(),
    context: params?.context ?? {
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
  };
}

export function makeContained(params?: Partial<Contained>): Contained {
  const resourceType = faker.helpers.arrayElement(["Organization", "Practitioner", "Patinet"]);
  if (resourceType === "Organization") return makeContainedOrg(params);
  if (resourceType === "Practitioner") return makeContainedPractitioner(params);
  return makeContainedPatient(params);
}

function makeContainedBase(params?: Partial<Contained>): Contained {
  const containedId = faker.string.nanoid();
  return {
    id: params?.id ?? containedId,
    identifier: params?.identifier ?? [
      {
        value: faker.number.int({ min: 1000, max: 99999 }).toString(),
      },
    ],
  };
}

export function makeContainedOrg(params?: Partial<Contained>): Contained {
  return {
    ...makeContainedBase(params),
    resourceType: params?.resourceType ?? "Organization",
    name: params?.name ?? faker.company.name(),
  };
}

export function makeContainedPractitioner(params?: Partial<Contained>): Contained {
  return {
    ...makeContainedBase(params),
    resourceType: params?.resourceType ?? "Practitioner",
    name: params?.name ?? {
      family: [faker.person.lastName()],
      given: [faker.person.firstName()],
      prefix: [""],
    },
    organization: params?.organization ?? {
      reference: `#${uuidv4()}`,
    },
  };
}

export function makeContainedPatient(params?: Partial<Contained>): Contained {
  return {
    ...makeContainedBase(params),
    resourceType: params?.resourceType ?? "Patient",
    name: params?.name ?? {
      family: [faker.person.lastName()],
      given: [faker.person.firstName()],
      prefix: [""],
    },
  };
}
