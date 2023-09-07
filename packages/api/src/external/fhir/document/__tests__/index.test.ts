import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
/* eslint-disable @typescript-eslint/no-empty-function */
import { Organization, Practitioner, Reference, Resource } from "@medplum/fhirtypes";
import { Document } from "@metriport/commonwell-sdk";
import { makeDocument } from "@metriport/commonwell-sdk/models/__tests__/document";
import { v4 as uuidv4 } from "uuid";
import { getAuthors } from "../index";

let practitionerId: string;
let orgId: string;
let cwContained: { reference: string }[];
let docMock: Document;

beforeEach(() => {
  jest.restoreAllMocks();
  practitionerId = uuidv4();
  orgId = uuidv4();
  cwContained = [{ reference: `#${practitionerId}` }, { reference: `#${orgId}` }];
  docMock = makeDocument({ content: { author: cwContained } });
});

describe("getAuthors", () => {
  it("returns multiple authors when multiple contained", async () => {
    const contained: Resource[] = [
      {
        resourceType: "Practitioner",
        id: practitionerId,
      },
      {
        resourceType: "Organization",
        id: orgId,
      },
    ];
    const expectedAuthors: Reference<Organization | Practitioner>[] = [
      {
        type: "Practitioner",
        reference: `#${practitionerId}`,
      },
      {
        type: "Organization",
        reference: `#${orgId}`,
      },
    ];
    const authors = getAuthors(docMock.content, contained, uuidv4());
    expect(authors).toBeTruthy();
    expect(authors.length).toEqual(expectedAuthors.length);
    expect(authors).toEqual(expect.arrayContaining(expectedAuthors));
  });

  it("returns empty authors when no matching contained", async () => {
    const contained: Resource[] = [
      {
        resourceType: "Practitioner",
        id: uuidv4(),
      },
      {
        resourceType: "Organization",
        id: uuidv4(),
      },
    ];
    const expectedAuthors: Reference<Organization | Practitioner>[] = [];
    const authors = getAuthors(docMock.content, contained, uuidv4());
    expect(authors).toBeTruthy();
    expect(authors.length).toEqual(expectedAuthors.length);
    expect(authors).toEqual(expect.arrayContaining(expectedAuthors));
  });

  describe("does not return as author", () => {
    for (const resourceType of ["Account", "Appointment", "Encounter", "Medication"] as const) {
      it(`does not return as author - ${resourceType}`, async () => {
        const resourceId = uuidv4();
        const contained: Resource[] = [
          {
            resourceType: "Practitioner",
            id: practitionerId,
          },
          {
            resourceType: resourceType,
            id: resourceId,
          },
        ];
        cwContained = [{ reference: `#${practitionerId}` }, { reference: `#${resourceId}` }];
        docMock = makeDocument({ content: { author: cwContained } });
        const authors = getAuthors(docMock.content, contained, uuidv4());
        expect(authors).toBeTruthy();
        expect(authors.length).toEqual(1);
        expect(authors[0].reference).toEqual(`#${practitionerId}`);
        expect(authors[0].reference).not.toEqual(resourceId);
      });
    }
  });
});
