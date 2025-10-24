/* eslint-disable @typescript-eslint/no-explicit-any */

import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { Command } from "commander";
import fs from "fs";

/**
 * Demo script showcasing reverse reference functionality in FHIR SDK
 *
 * This script demonstrates reverse reference lookup capabilities by:
 * 1. Loading a FHIR bundle from a file
 * 2. Finding the first patient in the bundle
 * 3. Demonstrating various reverse reference lookup patterns
 *
 * Usage:
 * $ ts-node src/fhir-sdk/demo-reverse-references.ts --bundle-path /path/to/bundle.json
 */

type ScriptParams = {
  bundlePath: string;
};

/**
 * Randomly sample up to maxItems from an array for console display.
 * Logs a message if sampling occurs.
 */
function sampleForDisplay<T>(items: T[], maxItems = 5): T[] {
  if (items.length <= maxItems) {
    return items;
  }

  console.log(`  (Randomly sampling ${maxItems} of ${items.length} items for display)`);
  // Shuffle and take first maxItems
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxItems);
}

/**
 * Main function to run the demo script
 */
async function main() {
  const program = new Command();
  program
    .name("demo-reverse-references")
    .description("Demonstrate reverse reference functionality in FHIR SDK")
    .requiredOption("-b, --bundle-path <path>", "Path to FHIR bundle JSON file")
    .parse(process.argv);

  const options = program.opts();

  const params: ScriptParams = {
    bundlePath: options.bundlePath,
  };

  try {
    await runScript(params);
    process.exit(0);
  } catch (error) {
    console.error(`>>> Error: ${error}`);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function logRunParams(params: ScriptParams): void {
  console.log(`>>> Starting reverse reference demo...`);
  console.log(`>>> Bundle file: ${params.bundlePath}`);
}

async function runScript(params: ScriptParams): Promise<void> {
  logRunParams(params);

  // Load the bundle
  console.log(`>>> Loading bundle from file...`);
  const bundleContent = fs.readFileSync(params.bundlePath, "utf-8");
  const bundle = JSON.parse(bundleContent) as Bundle;
  const sdk = await FhirBundleSdk.create(bundle);

  console.log(`>>> Bundle loaded successfully with ${sdk.total} entries`);

  // Find the first patient
  const patients = sdk.getPatients();
  if (patients.length === 0) {
    throw new Error("No patients found in bundle. This demo requires at least one patient.");
  }

  const patient = patients[0];
  if (!patient.id) {
    throw new Error("First patient has no ID");
  }

  console.log(`>>> Found ${patients.length} patient(s), using first one: ${patient.id}`);
  console.log();

  await demonstrateReverseReferences(sdk, patient.id);
}

async function demonstrateReverseReferences(sdk: FhirBundleSdk, patientId: string): Promise<void> {
  console.log("=".repeat(80));
  console.log("FHIR SDK - Reverse Reference Lookup Demo");
  console.log("=".repeat(80));
  console.log();

  // ============================================================================
  // DEMO 1: Find all resources that reference a patient
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 1: Find all resources that reference a specific patient");
  console.log("─".repeat(80));

  console.log(`\n🔍 Finding all resources that reference Patient/${patientId}...\n`);

  const referencingPatient = sdk.getResourcesReferencingId(patientId);

  console.log(`Found ${referencingPatient.length} resources:\n`);
  const sampledResources = sampleForDisplay(referencingPatient);
  for (const resource of sampledResources) {
    console.log(`  ✓ ${resource.resourceType}/${resource.id}`);
  }
  console.log();

  // ============================================================================
  // DEMO 2: Filter by resource type
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 2: Filter reverse references by resource type");
  console.log("─".repeat(80));

  console.log(`\n🔍 Finding only Observations that reference Patient/${patientId}...\n`);

  const observations = sdk.getResourcesReferencingId(patientId, {
    resourceType: "Observation",
  });

  console.log(`Found ${observations.length} Observation(s):\n`);
  const sampledObs = sampleForDisplay(observations);
  for (const obs of sampledObs) {
    const obsData = obs as any;
    console.log(`  ✓ Observation/${obs.id}`);
    console.log(`    Code: ${obsData.code?.text || "N/A"}`);
    console.log(
      `    Value: ${obsData.valueQuantity?.value || "N/A"} ${obsData.valueQuantity?.unit || ""}`
    );
  }
  console.log();

  // ============================================================================
  // DEMO 3: Filter by reference field
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 3: Filter reverse references by field name");
  console.log("─".repeat(80));

  console.log(
    `\n🔍 Finding resources that reference Patient/${patientId} via 'subject' field...\n`
  );

  const subjectReferences = sdk.getResourcesReferencingId(patientId, {
    referenceField: "subject",
  });

  console.log(`Found ${subjectReferences.length} resource(s) with 'subject' reference:\n`);
  const sampledSubjects = sampleForDisplay(subjectReferences);
  for (const resource of sampledSubjects) {
    console.log(`  ✓ ${resource.resourceType}/${resource.id}`);
  }
  console.log();

  // ============================================================================
  // DEMO 4: Combined filters
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 4: Combine resource type and field filters");
  console.log("─".repeat(80));

  // Find a practitioner to use in the demo
  const practitioners = sdk.getPractitioners();
  if (practitioners.length > 0 && practitioners[0].id) {
    const practitionerId = practitioners[0].id;
    console.log(
      `\n🔍 Finding Observations that reference Practitioner/${practitionerId} via 'performer'...\n`
    );

    const performerObs = sdk.getResourcesReferencingId(practitionerId, {
      resourceType: "Observation",
      referenceField: "performer",
    });

    console.log(`Found ${performerObs.length} Observation(s):\n`);
    const sampledPerformerObs = sampleForDisplay(performerObs);
    for (const obs of sampledPerformerObs) {
      console.log(`  ✓ Observation/${obs.id}`);
      console.log(`    Performed by: Practitioner/${practitionerId}`);
    }
  } else {
    console.log("\n⚠️  No practitioners found in bundle, skipping this demo\n");
  }
  console.log();

  // ============================================================================
  // DEMO 5: Smart resource method
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 5: Using smart resource getReferencingResources() method");
  console.log("─".repeat(80));

  const patient = sdk.getPatientById(patientId);
  if (patient) {
    console.log(`\n👤 Patient: ${patient.name?.[0]?.family}, ${patient.name?.[0]?.given?.[0]}`);
    console.log(`   Gender: ${patient.gender}`);
    console.log(`   Birth Date: ${patient.birthDate}\n`);

    // Use the smart resource method
    const referencingResources = (patient as any).getReferencingResources();

    console.log(`📊 This patient is referenced by ${referencingResources.length} resources:\n`);

    // Group by resource type
    const byType = referencingResources.reduce((acc: any, r: any) => {
      acc[r.resourceType] = (acc[r.resourceType] || 0) + 1;
      return acc;
    }, {});

    for (const [type, count] of Object.entries(byType)) {
      console.log(`  • ${type}: ${count}`);
    }
  }
  console.log();

  // ============================================================================
  // DEMO 6: Discover related encounters
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 6: Discover what happened during an encounter");
  console.log("─".repeat(80));

  // Find an encounter to use in the demo
  const encounters = sdk.getEncounters();
  if (encounters.length > 0 && encounters[0].id) {
    const encounterId = encounters[0].id;
    console.log(`\n🏥 Finding all clinical activities during Encounter/${encounterId}...\n`);

    const encounterReferences = sdk.getResourcesReferencingId(encounterId, {
      referenceField: "encounter",
    });

    console.log(`Found ${encounterReferences.length} clinical record(s) from this encounter:\n`);
    const sampledEncounterRefs = sampleForDisplay(encounterReferences);
    for (const resource of sampledEncounterRefs) {
      const data = resource as any;
      console.log(`  📋 ${resource.resourceType}/${resource.id}`);

      if (resource.resourceType === "Observation") {
        console.log(`     Type: ${data.code?.text || "N/A"}`);
        console.log(`     Status: ${data.status}`);
      } else if (resource.resourceType === "DiagnosticReport") {
        console.log(`     Type: ${data.code?.text || "N/A"}`);
        console.log(`     Status: ${data.status}`);
        console.log(`     Results: ${data.result?.length || 0} observation(s)`);
      }
    }
  } else {
    console.log("\n⚠️  No encounters found in bundle, skipping this demo\n");
  }
  console.log();

  // ============================================================================
  // DEMO 7: Performance comparison
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 7: Performance - O(1) reverse lookup");
  console.log("─".repeat(80));

  console.log("\n⚡ Running 1000 reverse reference lookups...\n");

  const iterations = 1000;
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    sdk.getResourcesReferencingId(patientId);
  }

  const endTime = performance.now();
  const avgTime = (endTime - startTime) / iterations;

  console.log(`  Total time: ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`  Average per lookup: ${avgTime.toFixed(4)}ms`);
  console.log(
    `  Performance: ${
      avgTime < 0.1
        ? "✅ Excellent (< 0.1ms)"
        : avgTime < 1
        ? "✅ Good (< 1ms)"
        : "⚠️ Could be better"
    }`
  );
  console.log();

  // ============================================================================
  // DEMO 8: Bi-directional reference navigation
  // ============================================================================
  console.log("─".repeat(80));
  console.log("DEMO 8: Bi-directional reference navigation");
  console.log("─".repeat(80));

  console.log("\n🔄 Demonstrating forward and reverse reference navigation...\n");

  // Find an observation to use in the demo
  const observationsList = sdk.getObservations();
  if (observationsList.length > 0) {
    const observation = observationsList[0];
    console.log(`Starting from: Observation/${observation.id}`);
    console.log();

    // Forward reference: Get the patient
    console.log("➡️  Forward: observation.getSubject()");
    const subject = observation.getSubject();
    if (subject) {
      console.log(`    Found: ${subject.resourceType}/${subject.id}`);
      console.log();

      // Reverse reference: Get all resources referencing this patient
      console.log("⬅️  Reverse: patient.getReferencingResources()");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backReferences = (subject as any).getReferencingResources();
      console.log(`    Found ${backReferences.length} resources referencing this patient:`);
      const sampledBackRefs = sampleForDisplay(backReferences);
      for (const ref of sampledBackRefs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = ref as any;
        console.log(`      • ${r.resourceType}/${r.id}`);
      }
    } else {
      console.log("    ⚠️  No subject found");
    }
  } else {
    console.log("⚠️  No observations found in bundle, skipping this demo");
  }
  console.log();

  // ============================================================================
  console.log("=".repeat(80));
  console.log("✨ Demo complete! All reverse reference features showcased.");
  console.log("=".repeat(80));
  console.log("\n✅ Demo completed successfully\n");
}

main();
