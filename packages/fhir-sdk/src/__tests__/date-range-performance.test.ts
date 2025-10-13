/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { FhirBundleSdk } from "../index";
import { Bundle, Observation } from "@medplum/fhirtypes";

// Skip these tests by default as its a performance test that is slow and will slow down CI.
describe.skip("Date Range Search - Large Scale Performance", () => {
  const ONE_MILLION = 1_000_000;

  describe("1 Million Resources", () => {
    let largeBundle: Bundle;
    let sdk: FhirBundleSdk;

    beforeAll(() => {
      console.log(`\n🔨 Building bundle with ${ONE_MILLION.toLocaleString()} resources...`);
      const startBuild = performance.now();

      largeBundle = {
        resourceType: "Bundle",
        type: "searchset",
        entry: [],
      };

      // Generate 1 million observations spread over 2024
      // Each observation has a date somewhere in the year
      const startDate = new Date("2024-01-01").getTime();
      const endDate = new Date("2024-12-31").getTime();
      const dateRange = endDate - startDate;

      for (let i = 0; i < ONE_MILLION; i++) {
        // Distribute dates across the year
        const randomOffset = (i / ONE_MILLION) * dateRange;
        const date = new Date(startDate + randomOffset).toISOString();

        largeBundle.entry!.push({
          resource: {
            resourceType: "Observation",
            id: `obs-${i}`,
            status: "final",
            code: { text: `Test ${i % 100}` },
            effectiveDateTime: date,
          } as Observation,
        });

        // Log progress every 100k resources
        if ((i + 1) % 100_000 === 0) {
          console.log(`  ✓ Generated ${(i + 1).toLocaleString()} resources`);
        }
      }

      const endBuild = performance.now();
      console.log(`✅ Bundle built in ${((endBuild - startBuild) / 1000).toFixed(2)}s\n`);
    });

    it("should index 1 million resources efficiently", () => {
      console.log("📊 Indexing 1 million resources...");
      const start = performance.now();

      sdk = FhirBundleSdk.createSync(largeBundle);

      const end = performance.now();
      const duration = end - start;
      const durationSeconds = duration / 1000;
      const resourcesPerSecond = ONE_MILLION / durationSeconds;

      console.log(`\n⏱️  Indexing Performance:`);
      console.log(`  • Total time: ${durationSeconds.toFixed(2)}s`);
      console.log(`  • Resources/second: ${Math.round(resourcesPerSecond).toLocaleString()}`);
      console.log(`  • Average time per resource: ${(duration / ONE_MILLION).toFixed(3)}ms\n`);

      expect(sdk).toBeDefined();
      // Should index at least 10,000 resources per second
      expect(resourcesPerSecond).toBeGreaterThan(10_000);
    });

    describe("Search Performance", () => {
      it("should search 1 month range efficiently", () => {
        console.log("🔍 Searching 1-month range...");
        const start = performance.now();

        const results = sdk.searchByDateRange({
          dateFrom: "2024-06-01",
          dateTo: "2024-06-30",
        });

        const end = performance.now();
        const duration = end - start;

        console.log(`\n⏱️  1-Month Search:`);
        console.log(`  • Time: ${duration.toFixed(2)}ms`);
        console.log(`  • Results: ${results.length.toLocaleString()}`);
        console.log(`  • Time per result: ${(duration / results.length).toFixed(3)}ms\n`);

        expect(results.length).toBeGreaterThan(0);
        // Should complete in under 100ms
        expect(duration).toBeLessThan(100);
      });

      it("should search 1 week range efficiently", () => {
        console.log("🔍 Searching 1-week range...");
        const start = performance.now();

        const results = sdk.searchByDateRange({
          dateFrom: "2024-06-01",
          dateTo: "2024-06-07",
        });

        const end = performance.now();
        const duration = end - start;

        console.log(`\n⏱️  1-Week Search:`);
        console.log(`  • Time: ${duration.toFixed(2)}ms`);
        console.log(`  • Results: ${results.length.toLocaleString()}`);
        console.log(`  • Time per result: ${(duration / results.length).toFixed(3)}ms\n`);

        expect(results.length).toBeGreaterThan(0);
        // Should complete in under 50ms
        expect(duration).toBeLessThan(50);
      });

      it("should search 1 day range efficiently", () => {
        console.log("🔍 Searching 1-day range...");
        const start = performance.now();

        const results = sdk.searchByDateRange({
          dateFrom: "2024-06-15",
          dateTo: "2024-06-15",
        });

        const end = performance.now();
        const duration = end - start;

        console.log(`\n⏱️  1-Day Search:`);
        console.log(`  • Time: ${duration.toFixed(2)}ms`);
        console.log(`  • Results: ${results.length.toLocaleString()}`);
        if (results.length > 0) {
          console.log(`  • Time per result: ${(duration / results.length).toFixed(3)}ms`);
        }
        console.log();

        // Should complete very quickly even if no results
        expect(duration).toBeLessThan(20);
      });

      it("should search full year range efficiently", () => {
        console.log("🔍 Searching full year range...");
        const start = performance.now();

        const results = sdk.searchByDateRange({
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
        });

        const end = performance.now();
        const duration = end - start;
        const durationSeconds = duration / 1000;

        console.log(`\n⏱️  Full Year Search:`);
        console.log(`  • Time: ${durationSeconds.toFixed(2)}s`);
        console.log(`  • Results: ${results.length.toLocaleString()}`);
        console.log(`  • Time per result: ${(duration / results.length).toFixed(3)}ms\n`);

        expect(results.length).toBe(ONE_MILLION);
        // Should complete in under 5 seconds even for all results
        expect(duration).toBeLessThan(5000);
      });

      it("should handle multiple consecutive searches efficiently", () => {
        console.log("🔍 Running 100 consecutive searches...");
        const searches = 100;
        const start = performance.now();

        for (let i = 0; i < searches; i++) {
          // Search different months
          const month = (i % 12) + 1;
          const monthStr = month.toString().padStart(2, "0");

          sdk.searchByDateRange({
            dateFrom: `2024-${monthStr}-01`,
            dateTo: `2024-${monthStr}-28`,
          });
        }

        const end = performance.now();
        const duration = end - start;
        const avgDuration = duration / searches;

        console.log(`\n⏱️  100 Consecutive Searches:`);
        console.log(`  • Total time: ${duration.toFixed(2)}ms`);
        console.log(`  • Average per search: ${avgDuration.toFixed(2)}ms`);
        console.log(`  • Searches per second: ${Math.round(1000 / avgDuration)}\n`);

        // Average should be under 50ms per search
        expect(avgDuration).toBeLessThan(50);
      });
    });

    describe("Comparison with Linear Search", () => {
      function linearSearchByDate(bundle: Bundle, dateFrom: string, dateTo: string): number {
        const fromMs = new Date(dateFrom).getTime();
        const toMs = new Date(dateTo).getTime();
        let count = 0;

        for (const entry of bundle.entry ?? []) {
          if (entry.resource?.resourceType === "Observation") {
            const obs = entry.resource as Observation;
            if (obs.effectiveDateTime) {
              const dateMs = new Date(obs.effectiveDateTime).getTime();
              if (dateMs >= fromMs && dateMs <= toMs) {
                count++;
              }
            }
          }
        }

        return count;
      }

      it("should be significantly faster than linear search", () => {
        console.log("⚖️  Comparing interval tree vs linear search...");

        // Test with 1-month range
        const dateFrom = "2024-06-01";
        const dateTo = "2024-06-30";

        // Interval tree search
        console.log("\n  Testing interval tree...");
        const treeStart = performance.now();
        const treeResults = sdk.searchByDateRange({ dateFrom, dateTo });
        const treeEnd = performance.now();
        const treeDuration = treeEnd - treeStart;

        // Linear search
        console.log("  Testing linear search...");
        const linearStart = performance.now();
        const linearCount = linearSearchByDate(largeBundle, dateFrom, dateTo);
        const linearEnd = performance.now();
        const linearDuration = linearEnd - linearStart;

        const speedup = linearDuration / treeDuration;

        console.log(`\n📊 Performance Comparison (1-month search):`);
        console.log(`  • Interval Tree: ${treeDuration.toFixed(2)}ms`);
        console.log(`  • Linear Search: ${linearDuration.toFixed(2)}ms`);
        console.log(`  • Speedup: ${speedup.toFixed(1)}x faster`);
        console.log(`  • Results matched: ${treeResults.length === linearCount}\n`);

        expect(treeResults.length).toBe(linearCount);
        // Interval tree should be significantly faster (at least 5x)
        expect(speedup).toBeGreaterThan(5);
      });
    });

    describe("Memory Efficiency", () => {
      it("should report memory usage", () => {
        if (typeof process !== "undefined" && process.memoryUsage) {
          const memUsage = process.memoryUsage();

          console.log(`\n💾 Memory Usage:`);
          console.log(`  • Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
          console.log(`  • Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
          console.log(`  • External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
          console.log(
            `  • Per resource: ${((memUsage.heapUsed / ONE_MILLION) * 1024).toFixed(2)} bytes\n`
          );
        }

        expect(true).toBe(true);
      });
    });
  });
});
