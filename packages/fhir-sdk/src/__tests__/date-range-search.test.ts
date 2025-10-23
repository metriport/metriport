/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { FhirBundleSdk } from "../index";
import { Bundle, Observation, Condition, Encounter } from "@medplum/fhirtypes";

describe("Date Range Search", () => {
  const testBundle: Bundle = {
    resourceType: "Bundle",
    type: "searchset",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "patient-1",
        },
      },
      {
        resource: {
          resourceType: "Observation",
          id: "obs-1",
          status: "final",
          code: { text: "Blood Pressure" },
          effectiveDateTime: "2024-01-15T10:00:00Z",
        } as Observation,
      },
      {
        resource: {
          resourceType: "Observation",
          id: "obs-2",
          status: "final",
          code: { text: "Heart Rate" },
          effectiveDateTime: "2024-03-20T14:30:00Z",
        } as Observation,
      },
      {
        resource: {
          resourceType: "Condition",
          id: "condition-1",
          clinicalStatus: { text: "active" },
          code: { text: "Hypertension" },
          onsetDateTime: "2024-02-10T08:00:00Z",
          recordedDate: "2024-02-11",
        } as Condition,
      },
      {
        resource: {
          resourceType: "Encounter",
          id: "encounter-1",
          status: "finished",
          class: { code: "outpatient" },
          period: {
            start: "2024-01-10T09:00:00Z",
            end: "2024-01-10T10:00:00Z",
          },
        } as Encounter,
      },
      {
        resource: {
          resourceType: "Encounter",
          id: "encounter-2",
          status: "finished",
          class: { code: "inpatient" },
          period: {
            start: "2024-04-01T08:00:00Z",
            end: "2024-04-05T12:00:00Z",
          },
        } as Encounter,
      },
    ],
  };

  describe("Basic date range search", () => {
    it("should find resources within a date range", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-01-01",
        dateTo: "2024-01-31",
      });

      expect(results.length).toBeGreaterThan(0);

      const resourceIds = results.map(r => r.id);
      expect(resourceIds).toContain("obs-1");
      expect(resourceIds).toContain("encounter-1");
      expect(resourceIds).not.toContain("obs-2");
      expect(resourceIds).not.toContain("condition-1");
    });

    it("should find resources with Date objects", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: new Date("2024-02-01"),
        dateTo: new Date("2024-02-28"),
      });

      const resourceIds = results.map(r => r.id);
      expect(resourceIds).toContain("condition-1");
    });

    it("should search from a start date to current date when dateTo is omitted", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-01-01",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Filtered date range search", () => {
    it("should filter by resource type", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
        resourceTypes: ["Observation"],
      });

      expect(results.length).toBe(2);
      expect(results.every(r => r.resourceType === "Observation")).toBe(true);
    });

    it("should filter by multiple resource types", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
        resourceTypes: ["Observation", "Condition"],
      });

      expect(results.length).toBe(3);
      const resourceTypes = results.map(r => r.resourceType);
      expect(resourceTypes).toContain("Observation");
      expect(resourceTypes).toContain("Condition");
      expect(resourceTypes).not.toContain("Encounter");
    });

    it("should filter by date field", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-02-01",
        dateTo: "2024-02-28",
        dateFields: ["recordedDate"],
      });

      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe("condition-1");
    });

    it("should filter by both resource type and date field", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
        resourceTypes: ["Observation"],
        dateFields: ["effectiveDateTime"],
      });

      expect(results.length).toBe(2);
      expect(results.every(r => r.resourceType === "Observation")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should return empty array when no resources match date range", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      });

      expect(results).toEqual([]);
    });

    it("should throw error for invalid dateFrom", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      expect(() => {
        sdk.searchByDateRange({
          dateFrom: "invalid-date",
          dateTo: "2024-12-31",
        });
      }).toThrow("Invalid dateFrom parameter");
    });

    it("should handle resources with period dates", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-04-01",
        dateTo: "2024-04-30",
      });

      const resourceIds = results.map(r => r.id);
      expect(resourceIds).toContain("encounter-2");
    });

    it("should handle overlapping date ranges", async () => {
      const sdk = await FhirBundleSdk.create(testBundle);

      const results = sdk.searchByDateRange({
        dateFrom: "2024-04-03",
        dateTo: "2024-04-03",
      });

      const resourceIds = results.map(r => r.id);
      expect(resourceIds).toContain("encounter-2");
    });
  });

  describe("Performance", () => {
    it("should perform search efficiently on large bundles", async () => {
      const largeBundle: Bundle = {
        resourceType: "Bundle",
        type: "searchset",
        entry: [],
      };

      for (let i = 0; i < 1000; i++) {
        largeBundle.entry!.push({
          resource: {
            resourceType: "Observation",
            id: `obs-${i}`,
            status: "final",
            code: { text: `Test ${i}` },
            effectiveDateTime: new Date(2024, 0, 1 + (i % 365)).toISOString(),
          } as Observation,
        });
      }

      const sdk = await FhirBundleSdk.create(largeBundle);

      const start = performance.now();
      const results = sdk.searchByDateRange({
        dateFrom: "2024-01-01",
        dateTo: "2024-01-31",
      });
      const end = performance.now();

      expect(results.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(100);
    });
  });
});
