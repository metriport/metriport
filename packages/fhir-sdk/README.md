# @metriport/fhir-sdk

TypeScript SDK for parsing, querying, and manipulating FHIR bundles with smart reference resolution.

## Quick Start

```typescript
import { FhirBundleSdk } from "@metriport/fhir-sdk";

const sdk = new FhirBundleSdk(fhirBundle);
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

### 2. Smart Reference Resolution

Resources include typed getter methods for convenient and type-safe reference traversal:

```typescript
const observation = sdk.getObservationById("obs-123");

// Direct access to referenced resources
const patient = observation.getSubject<Patient>();
```

### 3. Bundle Export

You can export subsets of your bundle or export by resource type to quickly create custom bundles.

```typescript
// Export by resource IDs - great for diff bundles!
const subset = sdk.exportSubset(["patient-uuid-1", "obs-uuid-1"]);

// Export by resource type - great for resource type bundles!
const observationBundle = sdk.exportByType("Observation");
```

### 4. Validation

Validate your bundle to ensure there are no broken references.

```typescript
const result = sdk.validateReferences();
console.log(result.isValid); // boolean
console.log(result.brokenReferences); // Array of broken references
```

## Example Use Cases

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

### Example Use Case: Processing a bundle

```typescript
const processBundle = (bundle: Bundle) => {
  const sdk = new FhirBundleSdk(bundle);

  // Validate
  sdk.validateReferences({ throwOnInvalid: true });

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

## Available Resource Types

All FHIR resource types are supported with corresponding `get{ResourceType}()` and `get{ResourceType}ById()` methods:

`Patient`, `Observation`, `Encounter`, `Practitioner`, `Organization`, `Location`, `DiagnosticReport`, `Condition`, `AllergyIntolerance`, `MedicationRequest`, `Procedure`, `CarePlan`, `Goal`, `Device`, `Specimen`, `ImagingStudy`, `DocumentReference`, `Binary`, `Composition`, `ClinicalImpression`, `RiskAssessment`

## Smart Reference Methods

Each resource type includes appropriate reference resolution methods based on the FHIR specification:

- **Observation**: `getSubject()`, `getEncounter()`, `getPerformers()`
- **Patient**: `getGeneralPractitioners()`, `getManagingOrganization()`
- **Encounter**: `getSubject()`, `getParticipants()`
- **DiagnosticReport**: `getSubject()`, `getResults()`, `getPerformers()`

## Performance

- **getById**: O(1) lookup
- **getByType**: O(n) where n = resources of that type
- **Reference resolution**: O(1) traversal
- Memory efficient with smart caching
