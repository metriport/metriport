import {
  makeDocumentReferenceWithMetriportId,
  makeDocumentReference,
} from "./make-document-reference-with-metriport-id";
import { containsMetriportId } from "../shared";
import { faker } from "@faker-js/faker";

describe("filterDocRefsWithMetriportId", () => {
  it("should filter document references with Metriport IDs", () => {
    const metriportId1 = faker.string.uuid();
    const metriportId2 = faker.string.uuid();
    const docRefs = [
      makeDocumentReferenceWithMetriportId({ metriportId: metriportId1 }),
      makeDocumentReference(),
      makeDocumentReferenceWithMetriportId({ metriportId: metriportId2 }),
    ];

    const filteredDocRefs = docRefs.filter(containsMetriportId);

    expect(filteredDocRefs.length).toBe(2);
    expect(filteredDocRefs[0].metriportId).toBe(metriportId1);
    expect(filteredDocRefs[1].metriportId).toBe(metriportId2);
  });
});
