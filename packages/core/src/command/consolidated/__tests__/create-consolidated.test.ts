import { Bundle } from "@medplum/fhirtypes";
import { PatientDataConsolidator } from "../consolidated-create";

class PatientDataConsolidatorLocalImpl extends PatientDataConsolidator {
  override merge(newBundle: Bundle) {
    const superMerge = super.merge(newBundle);
    return {
      into: function (destination: Bundle): Bundle {
        return superMerge.into(destination);
      },
    };
  }
}

describe("NewConsolidatedDataConnectorLocal", () => {
  describe("mergeBundles", () => {
    const consolidator = new PatientDataConsolidatorLocalImpl("some-bucket", "us-east-2");

    it(`merges two empty bundles into an empty bundle`, async () => {
      const bundle1: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [],
      };
      const bundle2: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [],
      };
      const res = consolidator.merge(bundle2).into(bundle1);
      expect(res).toEqual(
        expect.objectContaining({ resourceType: "Bundle", type: "batch", entry: [] })
      );
    });

    it(`merges bundle w/ entries with bundle w/o entries into a bundle w/ entries`, async () => {
      const bundle1: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [{ resource: { resourceType: "Patient", id: "1" } }],
      };
      const bundle2: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [],
      };
      const res = consolidator.merge(bundle2).into(bundle1);
      expect(res).toEqual(bundle1);
    });

    it(`merges bundle2 into bundle1`, async () => {
      const bundle1: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [],
      };
      const res2 = { resource: { resourceType: "Patient", id: "1" } } as const;
      const bundle2: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res2],
      };
      const res = consolidator.merge(bundle2).into(bundle1);
      expect(res).toBe(bundle1);
      expect(res).toEqual(expect.objectContaining({ entry: [res2] }));
    });

    it(`merges bundles/entries w/ diff IDs`, async () => {
      const res1 = { resource: { resourceType: "Patient", id: "1" } } as const;
      const res2 = { resource: { resourceType: "Patient", id: "2" } } as const;
      const bundle1: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res1],
      };
      const bundle2: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res2],
      };
      const res = consolidator.merge(bundle2).into(bundle1);
      expect(res).toEqual(expect.objectContaining({ entry: [res1, res2] }));
    });

    it(`does not consider resource ID when merging bundles`, async () => {
      const res1 = { resource: { resourceType: "Patient", id: "1" } } as const;
      const res2 = { resource: { resourceType: "Patient", id: "2" } } as const;
      const bundle1: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res1],
      };
      const bundle2: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res1, res2],
      };
      const res = consolidator.merge(bundle2).into(bundle1);
      expect(res).toEqual(expect.objectContaining({ entry: [res1, res1, res2] }));
    });

    it(`does not consider resource type when merging bundles`, async () => {
      const res1 = { resource: { resourceType: "Patient", id: "1" } } as const;
      const res2 = { resource: { resourceType: "Condition", id: "1" } } as const;
      const bundle1: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res1],
      };
      const bundle2: Bundle = {
        resourceType: "Bundle",
        type: "batch",
        entry: [res2],
      };
      const res = consolidator.merge(bundle2).into(bundle1);
      expect(res).toEqual(expect.objectContaining({ entry: [res1, res2] }));
    });
  });
});
