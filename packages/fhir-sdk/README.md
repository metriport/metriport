# @metriport/fhir-sdk

A powerful TypeScript SDK for parsing, querying, and manipulating FHIR bundles with intelligent reference resolution and caching.

## 🚀 Features

- **Bundle Loading & Validation** - Load FHIR bundles with built-in validation
- **Lightning Fast Lookups** - O(1) resource retrieval by ID with intelligent indexing
- **Smart Reference Resolution** - Automatically resolve FHIR references with typed accessors
- **Type-Safe Resource Getters** - Strongly typed methods for all FHIR resource types
- **Memory Efficient Caching** - Intelligent caching system maintains object identity
- **Bundle Export Utilities** - Create subsets and filtered bundles
- **Full TypeScript Support** - Built on @medplum/fhirtypes with complete type safety
- **Reference Validation** - Validate and identify broken references in bundles

## 📦 Installation

```bash
npm install @metriport/fhir-sdk
```

## 🎯 Quick Start

```typescript
import { FhirBundleSdk, Smart, Patient, Observation } from "@metriport/fhir-sdk";

// Load your FHIR bundle
const sdk = new FhirBundleSdk(fhirBundle);

// Get all patients with smart reference resolution
const patients: Smart<Patient>[] = sdk.getPatients();

// Get specific resource by ID
const patient = sdk.getResourceById<Patient>("patient-123");

// Smart reference resolution - no manual reference following needed!
const observations = sdk.getObservations();
const glucoseObs = observations.find(obs => obs.code?.text === "Glucose");
const relatedPatient = glucoseObs?.getSubject<Patient>(); // Direct Patient access!
const patientName = relatedPatient?.name?.[0]?.family;
```

## 🔍 Core Concepts

### Smart Resources

The SDK transforms regular FHIR resources into "Smart Resources" that include intelligent getter methods for resolving references:

```typescript
// Regular FHIR Observation
const observation: Observation = {
  resourceType: "Observation",
  subject: { reference: "Patient/123" }, // Just a string reference
  // ...
};

// Smart Observation - includes reference resolution methods
const smartObs: Smart<Observation> = sdk.getObservations()[0];
const patient = smartObs.getSubject<Patient>(); // Returns actual Patient resource!
const encounter = smartObs.getEncounter(); // Returns actual Encounter resource!
const performers = smartObs.getPerformers(); // Returns array of actual resources!
```

### Reference Resolution

Smart resources automatically include typed getter methods based on the FHIR specification:

| Resource Type        | Available Methods              | Returns                                     |
| -------------------- | ------------------------------ | ------------------------------------------- |
| **Observation**      | `getSubject<T>()`              | Patient, Group, Device, or Location         |
|                      | `getEncounter()`               | Encounter                                   |
|                      | `getPerformers<T>()`           | Array of Practitioners, Organizations, etc. |
| **Patient**          | `getGeneralPractitioners<T>()` | Array of Practitioners or Organizations     |
|                      | `getManagingOrganization()`    | Organization                                |
| **Encounter**        | `getSubject<T>()`              | Patient or Group                            |
|                      | `getParticipants<T>()`         | Array of Practitioners, Devices, etc.       |
| **DiagnosticReport** | `getSubject<T>()`              | Patient, Group, Device, or Location         |
|                      | `getResults()`                 | Array of Observations                       |
|                      | `getPerformers<T>()`           | Array of Practitioners, Organizations, etc. |

_And many more - see the full [reference documentation](#-api-reference)_

## 🛠️ API Reference

### Constructor

```typescript
const sdk = new FhirBundleSdk(bundle: Bundle)
```

Creates a new SDK instance with the provided FHIR bundle. The bundle must have `resourceType: "Bundle"` and `type: "collection"`.

### Resource Retrieval

#### By ID

```typescript
// Generic resource retrieval
getResourceById<T>(id: string): Smart<T> | undefined

// Type-specific retrieval
getPatientById(id: string): Smart<Patient> | undefined
getObservationById(id: string): Smart<Observation> | undefined
// ... and more for all resource types
```

#### By Type

```typescript
// Get all resources of a specific type
getPatients(): Smart<Patient>[]
getObservations(): Smart<Observation>[]
getEncounters(): Smart<Encounter>[]
getPractitioners(): Smart<Practitioner>[]
getDiagnosticReports(): Smart<DiagnosticReport>[]
getAllergyIntolerances(): Smart<AllergyIntolerance>[]
getConditions(): Smart<Condition>[]
getOrganizations(): Smart<Organization>[]
getLocations(): Smart<Location>[]
// ... and more for all resource types
```

### Validation

```typescript
// Validate all references in the bundle
const result = sdk.validateReferences();
console.log(result.isValid); // boolean
console.log(result.brokenReferences); // Array of broken reference details

// Throw on validation errors
sdk.validateReferences({ throwOnInvalid: true });
```

### Bundle Export

```typescript
// Export specific resources by ID
const subset = sdk.exportSubset(["patient-1", "obs-1", "enc-1"]);

// Export all resources of a specific type
const observationsBundle = sdk.exportByType("Observation");

// Export multiple resource types
const clinicalBundle = sdk.exportByTypes(["Patient", "Observation", "Encounter"]);
```

## 💡 Usage Patterns

### Working with Observations

```typescript
const observations = sdk.getObservations();

for (const obs of observations) {
  // Get the patient for this observation
  const patient = obs.getSubject<Patient>();
  console.log(`Patient: ${patient?.name?.[0]?.family}`);

  // Get the encounter context
  const encounter = obs.getEncounter();
  console.log(`Encounter: ${encounter?.id}`);

  // Get who performed the observation
  const performers = obs.getPerformers();
  performers.forEach(performer => {
    if (performer.resourceType === "Practitioner") {
      console.log(`Performed by: ${performer.name?.[0]?.family}`);
    }
  });
}
```

### Reference Chaining

```typescript
// Chain through multiple references
const patient = sdk.getPatients()[0];
const organization = patient?.getManagingOrganization();
const parentOrg = organization?.getPartOf(); // Get parent organization

// Or in a more functional style
const orgName = sdk.getPatients()[0]?.getManagingOrganization()?.name;
```

### Building Clinical Summaries

```typescript
const buildPatientSummary = (patientId: string) => {
  const patient = sdk.getPatientById(patientId);
  if (!patient) return null;

  // Get all observations for this patient
  const observations = sdk.getObservations().filter(obs => obs.getSubject()?.id === patientId);

  // Get all encounters for this patient
  const encounters = sdk.getEncounters().filter(enc => enc.getSubject()?.id === patientId);

  // Get all conditions for this patient
  const conditions = sdk.getConditions().filter(cond => cond.getSubject()?.id === patientId);

  return {
    patient: {
      name: patient.name?.[0]?.family,
      birthDate: patient.birthDate,
    },
    observationCount: observations.length,
    encounterCount: encounters.length,
    conditionCount: conditions.length,
    recentObs: observations
      .sort((a, b) => (b.effectiveDateTime || "").localeCompare(a.effectiveDateTime || ""))
      .slice(0, 5),
  };
};
```

### Error Handling

```typescript
// The SDK handles errors gracefully
const observations = sdk.getObservations();

observations.forEach(obs => {
  // Reference resolution never throws - returns undefined for broken refs
  const patient = obs.getSubject<Patient>();

  if (patient) {
    console.log(`Valid patient reference: ${patient.id}`);
  } else {
    console.log("Broken or missing patient reference");
  }
});

// Validate references to find issues
const validation = sdk.validateReferences();
if (!validation.isValid) {
  console.log("Found broken references:");
  validation.brokenReferences.forEach(ref => {
    console.log(`${ref.sourceResourceType}/${ref.sourceResourceId} -> ${ref.reference}`);
  });
}
```

## ⚡ Performance Characteristics

- **Resource Lookup**: O(1) time complexity for ID-based lookups
- **Type Queries**: O(n) where n = number of resources of that type
- **Reference Resolution**: O(1) per reference resolution
- **Memory Efficient**: Smart caching maintains object identity and prevents duplicates
- **Lazy Loading**: References resolved on-demand, not pre-computed

## 🏗️ Advanced Usage

### Custom Type Guards

```typescript
import { Patient, Practitioner } from "@metriport/fhir-sdk";

const isPatient = (resource: any): resource is Smart<Patient> =>
  resource?.resourceType === "Patient";

const isPractitioner = (resource: any): resource is Smart<Practitioner> =>
  resource?.resourceType === "Practitioner";

// Use in reference resolution
const observation = sdk.getObservations()[0];
const subject = observation.getSubject();

if (isPatient(subject)) {
  // TypeScript knows this is Smart<Patient>
  console.log(subject.birthDate);
} else if (subject?.resourceType === "Group") {
  // Handle Group subject
  console.log(subject.name);
}
```

### Bundle Processing Pipeline

```typescript
const processClinicalData = (bundle: Bundle) => {
  const sdk = new FhirBundleSdk(bundle);

  // Validate first
  const validation = sdk.validateReferences();
  if (!validation.isValid) {
    throw new Error(`Invalid references: ${validation.brokenReferences.length}`);
  }

  // Process patients
  const patients = sdk.getPatients();
  const patientSummaries = patients.map(patient => ({
    id: patient.id,
    name: patient.name?.[0]?.family,
    observationCount: sdk.getObservations().filter(obs => obs.getSubject()?.id === patient.id)
      .length,
    encounterCount: sdk.getEncounters().filter(enc => enc.getSubject()?.id === patient.id).length,
  }));

  // Export relevant data
  const clinicalBundle = sdk.exportByTypes(["Patient", "Observation", "Encounter", "Condition"]);

  return { patientSummaries, clinicalBundle };
};
```

## 🤝 Contributing

This package follows functional programming principles:

- Immutable data structures
- Pure functions where possible
- No shared mutable state
- Deterministic behavior

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ by [Metriport](https://metriport.com) for the FHIR community**
