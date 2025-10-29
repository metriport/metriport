# @metriport/fhir-sdk

TypeScript SDK for parsing, querying, and manipulating FHIR R4 bundles with smart reference resolution.

## Quick Start

```typescript
import { FhirBundleSdk } from "@metriport/fhir-sdk";

// Create an SDK instance
const sdk = await FhirBundleSdk.create(fhirBundle);

// Access static methods directly on the class
const cleaned = FhirBundleSdk.stripNonClinicalData(patient);
```

## Core Functionality

### 1. Resource Retrieval

#### By ID

```typescript
// Generic
const resource = sdk.getResourceById<Patient>("patient-123");

// Type-specific
const patient = sdk.getPatientById("patient-123");
const observation = sdk.getObservationById("obs-456");
```

#### By Type

```typescript
const patients = sdk.getPatients();
const observations = sdk.getObservations();
const encounters = sdk.getEncounters();
const conditions = sdk.getConditions();
```

### 2. Coding System Utilities

All resources with CodeableConcept fields automatically have enhanced coding utilities for working with standard medical coding systems (LOINC, ICD-10, SNOMED, RxNorm, NDC).

**Important:** Use the specific Smart type aliases (`SmartObservation`, `SmartCondition`, etc.) instead of the generic `Smart<T>` pattern to get full TypeScript support for coding utilities.

```typescript
import { SmartObservation, SmartCondition } from "@metriport/fhir-sdk";

// ✅ GOOD - Use specific Smart type for full TypeScript support
const obs: SmartObservation = sdk.getObservationById("obs-123")!;

// Check if the observation uses LOINC coding
if (obs.code?.hasLoinc()) {
  const loincCode = obs.code.getLoincCode(); // Get first LOINC code
  console.log("LOINC code:", loincCode);
}

// Check for specific codes
if (obs.code?.hasLoincCode("2339-0")) {
  console.log("Found glucose measurement!");
}

// Work with ICD-10 codes in conditions
const condition: SmartCondition = sdk.getConditionById("cond-456")!;
const icd10Code = condition.code?.getIcd10Code();
const allIcd10 = condition.code?.getIcd10Codes(); // Get all ICD-10 codes

// Check if condition has specific ICD-10 codes
if (condition.code?.hasSomeIcd10(["E11.9", "E10.9"])) {
  console.log("Patient has diabetes");
}

// Find specific coding with custom logic
const diabetesCoding = condition.code?.findIcd10Coding(
  code => code.startsWith("E11") || code.startsWith("E10")
);
```

**Available Coding Systems:**

Each `SmartCodeableConcept` provides methods for these coding systems:

- **LOINC**: `hasLoinc()`, `getLoinc()`, `getLoincCode()`, `getLoincCodes()`, `hasLoincCode()`, `hasSomeLoinc()`, `findLoincCoding()`
- **ICD-10**: `hasIcd10()`, `getIcd10()`, `getIcd10Code()`, `getIcd10Codes()`, `hasIcd10Code()`, `hasSomeIcd10()`, `findIcd10Coding()`
- **SNOMED**: `hasSnomed()`, `getSnomed()`, `getSnomedCode()`, `getSnomedCodes()`, `hasSnomedCode()`, `hasSomeSnomed()`, `findSnomedCoding()`
- **RxNorm**: `hasRxNorm()`, `getRxNorm()`, `getRxNormCode()`, `getRxNormCodes()`, `hasRxNormCode()`, `hasSomeRxNorm()`, `findRxNormCoding()`
- **NDC**: `hasNdc()`, `getNdc()`, `getNdcCode()`, `getNdcCodes()`, `hasNdcCode()`, `hasSomeNdc()`, `findNdcCoding()`

**Smart Resource Types with Coding Utilities:**

```typescript
import {
  SmartObservation,
  SmartCondition,
  SmartProcedure,
  SmartAllergyIntolerance,
  SmartEncounter,
  SmartDiagnosticReport,
  SmartImmunization,
  SmartMedication,
  SmartMedicationRequest,
  SmartMedicationAdministration,
  SmartMedicationDispense,
  SmartMedicationStatement,
  SmartFamilyMemberHistory,
  SmartRelatedPerson,
  SmartRiskAssessment,
  SmartServiceRequest,
  SmartCarePlan,
  SmartPatient,
  SmartPractitioner,
  SmartOrganization,
  SmartLocation,
  SmartComposition,
  SmartCoverage,
  SmartDocumentReference,
} from "@metriport/fhir-sdk";
```

All SDK getter methods return the appropriate Smart type automatically:

```typescript
// These all return the specific Smart types with coding utilities
const observations: SmartObservation[] = sdk.getObservations();
const conditions: SmartCondition[] = sdk.getConditions();
const procedures: SmartProcedure[] = sdk.getProcedures();
```

### 3. Smart Reference Resolution

Resources include typed getter methods for convenient and type-safe reference traversal:

```typescript
const observation = sdk.getObservationById("obs-123");

// Direct access to referenced resources
const patient = observation.getSubject<Patient>();
```

**Smart Resource Methods:**

All smart resources include these utility methods:

**Automatic console.log formatting** - Resources automatically render nicely when printed:

```typescript
const patient = sdk.getPatientById("patient-123");

// Just use console.log directly - no need to call toString()!
console.log(patient);
// Output:
// {
//   resourceType: 'Patient',
//   id: 'patient-123',
//   name: [ { family: 'Doe', given: [Array] } ],
//   ...
// }
```

**toString()** - Manual formatting with custom spacing:

```typescript
// Use toString() if you need custom spacing
console.log(patient.toString(4)); // 4 spaces
const jsonString = patient.toString(0); // Compact JSON
```

This is useful for debugging and inspecting deeply nested structures. The output automatically excludes smart resource methods and shows the raw FHIR resource data.

**getReferencingResources()** - Find all resources that reference this resource:

```typescript
const patient = sdk.getPatientById("patient-123");

// Find all resources referencing this patient
const references = patient.getReferencingResources();

// Filter by resource type
const observations = patient.getReferencingResources({ resourceType: "Observation" });
```

**getReferencedResources()** - Find all resources referenced by this resource:

```typescript
const observation = sdk.getObservationById("obs-123");

// Get all resources this observation references
const referencedResources = observation.getReferencedResources();
// Returns: [Patient, Encounter, Practitioner, etc.] based on REFERENCE_METHOD_MAPPING

// SDK-level method also available
const refs = sdk.getResourcesReferencedBy(observation);
```

This method automatically discovers and returns all resources referenced by the current resource based on the configured reference methods in `REFERENCE_METHOD_MAPPING`. It handles both single references and array references.

### 4. Bundle Export

You can export subsets of your bundle or export by resource type to quickly create custom bundles.

```typescript
// Export by resource IDs - great for diff bundles!
const subset = sdk.exportSubset(["patient-uuid-1", "obs-uuid-1"]);

// Export by resource type - great for resource type bundles!
const observationBundle = sdk.exportByType("Observation");
```

### 5. Validation

Validate your bundle to ensure there are no broken references. A broken reference is a reference that points to a resource that does not exist in the bundle.

```typescript
const result = sdk.lookForBrokenReferences();
console.log(result.hasBrokenReferences); // true if at least one broken reference is found, false otherwise
console.log(result.brokenReferences); // All broken references in bundle
```

### 6. Reverse Reference Lookup

Find all resources that reference a given resource (reverse lookup). This is useful for discovering what refers to a specific resource.

```typescript
const patient = sdk.getPatientById("patient-123");

// Find all resources that reference this patient
const referencingResources = sdk.getResourcesReferencingId("patient-123");
console.log(referencingResources); // [Observation, Encounter, DiagnosticReport, ...]

// Filter by resource type
const observations = sdk.getResourcesReferencingId("patient-123", {
  resourceType: "Observation",
});

// Filter by reference field
const subjectReferences = sdk.getResourcesReferencingId("patient-123", {
  referenceField: "subject",
});

// Use smart resource method
const backRefs = patient.getReferencingResources();
const encounteredObs = patient.getReferencingResources({
  resourceType: "Observation",
  referenceField: "subject",
});
```

**Key Features:**

- **O(1) lookup** - constant time performance
- **Flexible filtering** - by resource type and/or reference field
- **Smart resources** - returns fully functional Smart resources
- **Bi-directional** - complements forward reference navigation

### 7. Date Range Search

Search for resources by date range using an interval tree index. This is useful for filtering resources by clinical dates efficiently.

```typescript
const sdk = await FhirBundleSdk.create(bundle);

// Basic date range search
const results = sdk.searchByDateRange({
  dateFrom: "2024-01-01",
  dateTo: "2024-01-31",
});

// Filter by resource type
const observations = sdk.searchByDateRange({
  dateFrom: "2024-01-01",
  dateTo: "2024-12-31",
  resourceTypes: ["Observation", "Condition"],
});

// Filter by specific date field
const recordedConditions = sdk.searchByDateRange({
  dateFrom: "2024-01-01",
  dateTo: "2024-12-31",
  dateFields: ["recordedDate"],
});

// Use Date objects
const recentResources = sdk.searchByDateRange({
  dateFrom: new Date("2024-01-01"),
  dateTo: new Date(),
});
```

**Key Features:**

- **O(log n + k) search** - efficient interval tree-based search where k is the number of matching resources
- **Multiple date fields** - indexes primary clinical dates (effectiveDateTime, onset, performed) and recorded dates
- **Flexible filtering** - by resource type and/or specific date fields
- **Smart resources** - returns fully functional Smart resources
- **Period support** - handles both single date fields and date periods/ranges

**Indexed Resource Types:**

The following resource types and date fields are automatically indexed:

- **Observation**: effectiveDateTime, effectivePeriod, effectiveInstant, issued
- **Condition**: onsetDateTime, onsetPeriod, abatementDateTime, abatementPeriod, recordedDate
- **Encounter**: period
- **Procedure**: performedDateTime, performedPeriod
- **Immunization**: occurrenceDateTime, recorded
- **DiagnosticReport**: effectiveDateTime, effectivePeriod, issued
- **MedicationRequest**: authoredOn
- **MedicationAdministration**: effectiveDateTime, effectivePeriod
- **MedicationStatement**: effectiveDateTime, effectivePeriod
- **MedicationDispense**: whenHandedOver, whenPrepared
- **DocumentReference**: date, context.period
- **Composition**: date
- **Coverage**: period
- **AllergyIntolerance**: onsetDateTime, onsetPeriod, lastOccurrence, recordedDate

### 8. Reference Walking (BFS Traversal)

Walk the reference graph starting from any resource using breadth-first search (BFS). This is useful for discovering all resources connected to a specific resource.

```typescript
const observation = sdk.getObservationById("obs-123");

// Walk all reachable resources
const result = sdk.walkReferences(observation);
console.log(result.allResources); // All resources reachable from observation
console.log(result.resourcesByDepth); // Resources organized by depth level
console.log(result.depthReached); // Maximum depth traversed

// Limit traversal depth
const limitedResult = sdk.walkReferences(observation, { maxDepth: 2 });

// Exclude the start resource from results
const withoutStart = sdk.walkReferences(observation, { includeStartResource: false });
```

### 9. LLM Context Generation

Generate comprehensive, LLM-friendly context from a resource and its related resources. This automatically performs BFS traversal, strips non-clinical metadata, and formats the output for optimal LLM consumption.

```typescript
const observation = sdk.getObservationById("obs-123");

// Generate structured text context (default, best for LLMs)
const llmContext = sdk.generateLLMContext(observation, {
  maxDepth: 2, // Default: 2
  format: "structured-text", // Default: 'structured-text'
});

// Send to your LLM
await llm.chat({
  messages: [
    { role: "system", content: "You are a medical data analyst." },
    { role: "user", content: `Analyze this patient data:\n\n${llmContext}` },
  ],
});

// Alternative: JSON format
const jsonContext = sdk.generateLLMContext(observation, {
  format: "json",
});
```

**Features:**

- Automatically discovers all related resources via BFS traversal
- Strips non-clinical metadata (`meta`, `extension`, `text`) to reduce tokens by ~30-40%
- Organizes resources hierarchically (primary → directly referenced → indirectly referenced)
- Groups resources by type within each depth level
- Logs resource counts for debugging (not included in output)

**Static Methods:**

The `FhirBundleSdk` class provides static utility methods that don't require an SDK instance:

```typescript
import { FhirBundleSdk } from "@metriport/fhir-sdk";

// Strip non-clinical data from any resource
const cleanedPatient = FhirBundleSdk.stripNonClinicalData(patient);
// Removes: meta, extension, modifierExtension, text, id, identifier, and all reference fields
// Returns immutable copy

// Create SDK instances
const sdk = await FhirBundleSdk.create(bundle); // Async (for backwards compatibility)
const sdk2 = FhirBundleSdk.createSync(bundle); // Synchronous
```

This is especially useful in REPL sessions where you want quick access to utility functions without creating a full SDK instance.

### 10. Type Guards

Filter mixed arrays of FHIR resources to specific types with full TypeScript type safety:

```typescript
import { Resource } from "@medplum/fhirtypes";
import { isPatient, isObservation, isDiagnosticReport } from "@metriport/fhir-sdk";

// Filter mixed resource arrays
const resources: Resource[] = [
  { resourceType: "Patient", id: "patient-1" },
  { resourceType: "Observation", id: "obs-1", status: "final", code: { text: "test" } },
  { resourceType: "DiagnosticReport", id: "report-1", status: "final", code: { text: "lab" } },
];

const patients = resources.filter(isPatient); // Patient[]
const observations = resources.filter(isObservation); // Observation[]

// TypeScript knows the exact type after filtering
patients.forEach(patient => {
  const name = patient.name; // ✅ Type-safe access to Patient fields
});

// Works with Smart resources too
const allObs = sdk.getObservations();
allObs.forEach(obs => {
  if (isObservation(obs)) {
    const subject = obs.getSubject(); // ✅ Smart methods available
    const status = obs.status; // ✅ Observation fields available
  }
});
```

**Available type guards:**
Use the `is<ResourceType>` type guard to check if a resource is of a specific type. There is one for every fhir resource type. Use them whenever possible over writing your own type guards.

## Example Use Cases

### Filter by Medical Codes

```typescript
import { SmartObservation, SmartCondition } from "@metriport/fhir-sdk";

// Find all glucose observations using LOINC codes
const glucoseObs = sdk.getObservations().filter(
  obs =>
    obs.code?.hasLoincCode("2339-0") || // Glucose [Mass/volume] in Blood
    obs.code?.hasLoincCode("2345-7") // Glucose [Mass/volume] in Serum or Plasma
);

// Find all diabetes conditions using ICD-10 codes
const diabetesConditions = sdk.getConditions().filter(cond =>
  cond.code?.findIcd10Coding(
    code =>
      code.startsWith("E10") || // Type 1 diabetes
      code.startsWith("E11") // Type 2 diabetes
  )
);

// Find medications by RxNorm code
const metforminMeds = sdk
  .getMedicationRequests()
  .filter(medReq => medReq.medicationCodeableConcept?.hasRxNormCode("6809"));

// Complex filtering with multiple coding systems
const labResults = sdk.getObservations().filter(obs => {
  if (obs.code?.hasLoinc()) {
    const loincCode = obs.code.getLoincCode();
    // Filter for specific lab panels
    return (
      loincCode?.startsWith("24331") || // Lipid panel
      loincCode?.startsWith("24362")
    ); // Complete blood count
  }
  return false;
});
```

### Patient Summary

```typescript
const buildPatientSummary = (patientId: string) => {
  const patient = sdk.getPatientById(patientId);
  const observations = sdk.getObservations().filter(obs => obs.getSubject()?.id === patientId);

  return {
    name: patient?.name?.[0]?.family,
    observationCount: observations.length,
    recentObs: observations.slice(0, 5),
  };
};
```

### Reference Traversal

```typescript
// Traverse multiple references in sequence
const orgName = sdk.getPatients()[0]?.getManagingOrganization()?.name;
```

### Extract Related Resources

```typescript
// Get all resources related to a specific observation
const extractRelatedResources = (observationId: string) => {
  const observation = sdk.getObservationById(observationId);
  if (!observation) return null;

  // Walk the graph to find all related resources up to 2 levels deep
  const result = sdk.walkReferences(observation, { maxDepth: 2 });

  return {
    observation,
    relatedResourceCount: result.allResources.length,
    resourcesByType: result.allResources.reduce((acc, resource) => {
      acc[resource.resourceType] = (acc[resource.resourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
};
```

### Example Use Case: Processing a bundle

```typescript
const processBundle = async (bundle: Bundle) => {
  const sdk = await FhirBundleSdk.create(bundle);

  const { hasBrokenReferences, brokenReferences } = sdk.lookForBrokenReferences();

  if (hasBrokenReferences) {
    throw new MetriportError("Broken references found in bundle", {
      brokenReferences,
    });
  }

  // Process
  const patients = sdk.getPatients();
  const summaries = patients.map(p => ({
    id: p.id,
    name: p.name?.[0]?.family,
    obsCount: sdk.getObservations().filter(obs => obs.getSubject()?.id === p.id).length,
  }));

  return summaries;
};
```

## Performance

- **getById**: O(1) lookup
- **getByType**: O(n) where n = resources of that type
- **Reference resolution**: O(1) traversal
- **Reverse reference lookup**: O(1) lookup

## Demo

To see reverse reference functionality in action, run:

```bash
# From the utils package
cd packages/utils
npx ts-node src/fhir-sdk/demo-reverse-references.ts --bundle-path /path/to/your/bundle.json
```

The demo will:

- Automatically find the first patient in your bundle
- Showcase all reverse reference capabilities:
  - Finding all resources that reference a specific resource
  - Filtering by resource type and reference field
  - Using smart resource methods
  - Bi-directional navigation
  - Performance characteristics
