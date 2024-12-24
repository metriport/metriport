import { getAiBriefContentFromBundle } from "../command/ai-brief/shared";
import { makeBundle } from "../external/fhir/__tests__/bundle";
import { stringToBase64 } from "../util/base64";

describe("getAiBriefContentFromBundle", () => {
  it("returns undefined when bundle has no Binary resource", () => {
    const bundle = makeBundle({ entries: [] });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns undefined when bundle has invalid Binary resource", () => {
    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          // missing required fields
        },
      ],
    });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns undefined when Binary resource has no data", () => {
    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          contentType: "text/plain",
          meta: {
            source: "metriport:ai-generated-brief",
          },
          // data field missing
        },
      ],
    });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns undefined when Binary resource has wrong meta source", () => {
    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          meta: {
            source: "some-other-source",
          },
          contentType: "text/plain",
          data: "test-data",
        },
      ],
    });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns decoded content when Binary resource has correct meta source", () => {
    const content = "Test AI Brief Content";
    const encodedContent = stringToBase64(content);

    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          meta: {
            source: "metriport:ai-generated-brief",
          },
          contentType: "text/plain",
          data: encodedContent,
        },
      ],
    });

    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBe(content);
  });

  it("returns content from correct Binary when multiple Binary resources exist", () => {
    const content = "Test AI Brief Content";
    const encodedContent = stringToBase64(content);

    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          meta: {
            source: "some-other-source",
          },
          contentType: "text/plain",
          data: "wrong-data",
        },
        {
          resourceType: "Binary",
          id: "456",
          meta: {
            source: "metriport:ai-generated-brief",
          },
          contentType: "text/plain",
          data: encodedContent,
        },
      ],
    });

    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBe(content);
  });

  it("returns first matching Binary content when multiple matching sources exist", () => {
    const firstContent = "First AI Brief Content";
    const secondContent = "Second AI Brief Content";
    const firstEncodedContent = stringToBase64(firstContent);
    const secondEncodedContent = stringToBase64(secondContent);

    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          meta: {
            source: "metriport:ai-generated-brief",
          },
          contentType: "text/plain",
          data: firstEncodedContent,
        },
        {
          resourceType: "Binary",
          id: "456",
          meta: {
            source: "metriport:ai-generated-brief",
          },
          contentType: "text/plain",
          data: secondEncodedContent,
        },
      ],
    });

    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBe(firstContent);
  });
});
