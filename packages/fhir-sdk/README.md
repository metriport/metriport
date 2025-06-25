# @metriport/fhir-sdk

FHIR Bundle SDK for parsing, querying, and manipulating FHIR bundles with reference resolution.

## Features

- Load and parse FHIR bundles
- O(1) resource lookup by ID
- Smart reference resolution with typed accessors
- Type-specific resource getters
- Bundle validation and export utilities
- Full TypeScript support with @medplum/fhirtypes

## Installation

```bash
npm install @metriport/fhir-sdk
```

## Usage

```typescript
import { FhirBundleSdk, Smart, Patient, Observation } from "@metriport/fhir-sdk";

const sdk = new FhirBundleSdk(bundle);

// Get all observations - returns Smart<Observation>[]
const observations: Smart<Observation>[] = sdk.getObservations();

// Access referenced patient directly
const glucoseObs = observations.find(obs => obs.code?.text === "Glucose");
const patient: Smart<Patient> | undefined = glucoseObs?.getSubject(); // Returns Smart<Patient>
const patientName = patient?.name?.[0]?.given?.[0];

// Export subset
const subset = sdk.exportByType("Observation");
```
