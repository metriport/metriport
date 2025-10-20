import { faker } from "@faker-js/faker";
import { makeBundle } from "../../../../external/fhir/__tests__/bundle";
import * as bundleShared from "../../bundle/bundle";
import { snomedCodeMd } from "../../../../fhir-deduplication/__tests__/examples/condition-examples";
import { makeCondition } from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";

function initTest() {
  const patientId = faker.string.uuid();
  const condition = makeCondition(
    {
      code: { coding: [snomedCodeMd] },
    },
    patientId
  );
  return { patientId, condition };
}

describe("createFullBundleEntries", () => {
  it("adds fullUrl and appends a PUT request to each BundleEntry with correct resource references", () => {
    const { patientId, condition } = initTest();
    const condition2 = makeCondition({ id: faker.string.uuid() }, patientId);
    const bundle = makeBundle({ entries: [condition, condition2], type: "transaction" });

    const updatedBundle = bundleShared.createFullBundleEntries(bundle);
    expect(updatedBundle.entry).toHaveLength(2);

    updatedBundle.entry?.forEach((entry, index) => {
      const resource = bundle.entry?.[index]?.resource;
      expect(entry.request).toEqual({
        method: "PUT",
        url: `${resource?.resourceType}/${resource?.id}`,
      });
      expect(entry.fullUrl).toEqual(`urn:uuid:${resource?.id}`);
    });
  });

  it("adds fullUrl and does not append requests to a collection Bundle", () => {
    const { patientId, condition } = initTest();
    const condition2 = makeCondition({ id: faker.string.uuid() }, patientId);
    const bundle = makeBundle({ entries: [condition, condition2], type: "collection" });

    const updatedBundle = bundleShared.createFullBundleEntries(bundle);
    expect(updatedBundle.entry).toHaveLength(2);

    updatedBundle.entry?.forEach((entry, index) => {
      const resource = bundle.entry?.[index]?.resource;
      expect(entry.request).toEqual(undefined);
      expect(entry.fullUrl).toEqual(`urn:uuid:${resource?.id}`);
    });
  });

  it("returns bundle unchanged when no entries exist", () => {
    const bundle = makeBundle({ entries: [], type: "collection" });
    const updatedBundle = bundleShared.createFullBundleEntries(bundle);
    expect(updatedBundle).toEqual(bundle);
  });
});
