import { Organization, Practitioner, Reference, Resource } from "@medplum/fhirtypes";
import { Document as CWDocument, DocumentContent } from "@metriport/commonwell-sdk";
import { makeDocument } from "@metriport/commonwell-sdk/models/__tests__/document";
import { v4 as uuidv4 } from "uuid";
import { convertToFHIRResource, getAuthors } from "../index";
import { docRefsWithOneAuthorPointingToMultipleContained } from "./cw-payloads";

let patientId: string;
let practitionerId: string;
let orgId: string;
let cwContained: { reference: string }[];
let docMock: CWDocument;

beforeEach(() => {
  jest.restoreAllMocks();
  patientId = uuidv4();
  practitionerId = uuidv4();
  orgId = uuidv4();
  cwContained = [{ reference: `#${practitionerId}` }, { reference: `#${orgId}` }];
  docMock = makeDocument({ content: { author: cwContained } });
});

const cwContainedToFHIR = ({ contained, subject }: DocumentContent): Resource[] => {
  if (!contained) return [];
  const containedContent: Resource[] = [];
  if (contained?.length) {
    contained.forEach(cwResource => {
      const fhirResource = convertToFHIRResource(cwResource, patientId, subject.reference);
      if (fhirResource) containedContent.push(...fhirResource);
    });
  }
  return containedContent;
};

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

  describe("returns single author... ", () => {
    for (const [idx, docref] of Object.entries(docRefsWithOneAuthorPointingToMultipleContained)) {
      it(`when multiple contained w/ same ref - ${idx}`, async () => {
        const cwContent = docref.content;
        const fhirContained = cwContainedToFHIR(cwContent);
        const authorReference = cwContent.author?.[0].reference;
        expect(authorReference).toBeTruthy();
        console.log(`authorReference ${authorReference}`);
        console.log(`fhirContained ${JSON.stringify(fhirContained)}`);
        const fhirContainedMatchingAuthorRef = fhirContained.filter(
          c => c.id === authorReference?.substring(1)
        );
        console.log(
          `fhirContainedMatchingAuthorRef ${JSON.stringify(fhirContainedMatchingAuthorRef)}`
        );
        const types = fhirContainedMatchingAuthorRef.map(c => c.resourceType).sort();
        console.log(`types ${JSON.stringify(types)}`);
        expect(types).toBeTruthy();
        expect(types.length).toBeGreaterThanOrEqual(1);
        const type = types[0];
        const expectedAuthors: Reference<Organization | Practitioner>[] = [
          { type, reference: authorReference },
        ];

        const authors = getAuthors(cwContent, fhirContained, uuidv4());
        expect(authors).toBeTruthy();
        expect(authors.length).toEqual(expectedAuthors.length);
        expect(authors).toEqual(expect.arrayContaining(expectedAuthors));
      });
    }
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
