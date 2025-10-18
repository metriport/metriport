import {
  Bundle,
  Condition,
  DiagnosticReport,
  Encounter,
  Location,
  Observation,
  Organization,
  Patient,
  Practitioner,
} from "@medplum/fhirtypes";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export const CONSTANT_TIME_EXPECTED_THRESHOLD_MS = dayjs
  .duration({ milliseconds: 12 })
  .asMilliseconds();

/**
 * Valid FHIR bundle with all resource types and proper references
 */
export const validCompleteBundle: Bundle = {
  resourceType: "Bundle",
  id: "test-bundle-complete",
  type: "collection",
  total: 9,
  entry: [
    {
      fullUrl: "urn:uuid:patient-123",
      resource: {
        resourceType: "Patient",
        id: "patient-123",
        name: [
          {
            family: "Doe",
            given: ["Jane"],
          },
        ],
        gender: "female",
        birthDate: "1970-01-01",
        address: [
          {
            line: ["123 Main St"],
            city: "Wilmington",
            state: "NC",
            postalCode: "28401",
            country: "USA",
          },
        ],
        contact: [
          {
            relationship: [
              {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/v2-0131",
                    code: "C",
                  },
                ],
              },
            ],
            organization: {
              reference: "Organization/org-123",
            },
          },
        ],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:practitioner-456",
      resource: {
        resourceType: "Practitioner",
        id: "practitioner-456",
        name: [
          {
            family: "Smith",
            given: ["John"],
            suffix: ["MD"],
          },
        ],
        qualification: [
          {
            code: {
              text: "Internal Medicine",
            },
            issuer: {
              reference: "Organization/org-123",
            },
          },
        ],
      } as Practitioner,
    },
    {
      fullUrl: "urn:uuid:org-123",
      resource: {
        resourceType: "Organization",
        id: "org-123",
        name: "Medical Center Hospital",
        type: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/organization-type",
                code: "prov",
                display: "Healthcare Provider",
              },
            ],
          },
        ],
      } as Organization,
    },
    {
      fullUrl: "urn:uuid:location-111",
      resource: {
        resourceType: "Location",
        id: "location-111",
        name: "Emergency Room",
        status: "active",
        mode: "instance",
      } as Location,
    },
    {
      fullUrl: "urn:uuid:condition-222",
      resource: {
        resourceType: "Condition",
        id: "condition-222",
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active",
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              code: "confirmed",
            },
          ],
        },
        code: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "38341003",
              display: "Hypertension",
            },
          ],
          text: "Hypertension",
        },
        subject: {
          reference: "Patient/patient-123",
        },
      } as Condition,
    },
    {
      fullUrl: "urn:uuid:encounter-789",
      resource: {
        resourceType: "Encounter",
        id: "encounter-789",
        status: "finished",
        class: {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: "AMB",
          display: "ambulatory",
        },
        subject: {
          reference: "Patient/patient-123",
        },
        participant: [
          {
            individual: {
              reference: "Practitioner/practitioner-456",
            },
          },
        ],
        diagnosis: [
          {
            condition: {
              reference: "Condition/condition-222",
            },
            use: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
                  code: "AD",
                  display: "Admission diagnosis",
                },
              ],
            },
            rank: 1,
          },
        ],
        location: [
          {
            location: {
              reference: "Location/location-111",
            },
            status: "active",
          },
        ],
        hospitalization: {
          origin: {
            reference: "Location/location-111",
          },
          destination: {
            reference: "Location/location-111",
          },
        },
        period: {
          start: "2023-09-29T14:00:00+00:00",
          end: "2023-09-29T15:00:00+00:00",
        },
      } as Encounter,
    },
    {
      fullUrl: "urn:uuid:observation-001",
      resource: {
        resourceType: "Observation",
        id: "observation-001",
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "2345-7",
              display: "Glucose SerPl-mCnc",
            },
          ],
          text: "Glucose",
        },
        subject: {
          reference: "Patient/patient-123",
        },
        encounter: {
          reference: "Encounter/encounter-789",
        },
        performer: [
          {
            reference: "Practitioner/practitioner-456",
          },
        ],
        valueQuantity: {
          value: 139,
          unit: "mg/dL",
          system: "http://unitsofmeasure.org",
          code: "mg/dL",
        },
        effectiveDateTime: "2023-09-29T14:26:24+00:00",
      } as Observation,
    },
    {
      fullUrl: "urn:uuid:diagnostic-report-002",
      resource: {
        resourceType: "DiagnosticReport",
        id: "diagnostic-report-002",
        status: "final",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                code: "LAB",
              },
            ],
          },
        ],
        code: {
          text: "Lab Results",
        },
        subject: {
          reference: "Patient/patient-123",
        },
        encounter: {
          reference: "Encounter/encounter-789",
        },
        performer: [
          {
            reference: "Practitioner/practitioner-456",
          },
        ],
        result: [
          {
            reference: "Observation/observation-001",
          },
        ],
        effectiveDateTime: "2023-09-29T14:26:24+00:00",
      } as DiagnosticReport,
    },
  ],
};

/**
 * Bundle with broken references for validation testing
 */
export const bundleWithBrokenReferences: Bundle = {
  resourceType: "Bundle",
  id: "test-bundle-broken-refs",
  type: "collection",
  total: 2,
  entry: [
    {
      fullUrl: "urn:uuid:patient-999",
      resource: {
        resourceType: "Patient",
        id: "patient-999",
        name: [{ family: "Test", given: ["Patient"] }],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:observation-broken",
      resource: {
        resourceType: "Observation",
        id: "observation-broken",
        status: "final",
        code: { text: "Test Observation" },
        subject: {
          reference: "Patient/nonexistent-patient", // Broken reference
        },
        encounter: {
          reference: "Encounter/nonexistent-encounter", // Broken reference
        },
        performer: [
          {
            reference: "Practitioner/nonexistent-practitioner", // Broken reference
          },
        ],
      } as Observation,
    },
  ],
};

/**
 * Bundle with fullUrl references for testing different reference styles
 */
export const bundleWithFullUrlReferences: Bundle = {
  resourceType: "Bundle",
  id: "test-bundle-fullurl-refs",
  type: "collection",
  total: 2,
  entry: [
    {
      fullUrl: "urn:uuid:patient-fullurl",
      resource: {
        resourceType: "Patient",
        id: "patient-fullurl",
        name: [{ family: "FullUrl", given: ["Patient"] }],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:observation-fullurl",
      resource: {
        resourceType: "Observation",
        id: "observation-fullurl",
        status: "final",
        code: { text: "Test Observation" },
        subject: {
          reference: "urn:uuid:patient-fullurl", // Reference by fullUrl
        },
      } as Observation,
    },
  ],
};

/**
 * Empty bundle for edge case testing
 */
export const emptyBundle: Bundle = {
  resourceType: "Bundle",
  id: "test-bundle-empty",
  type: "collection",
  total: 0,
  entry: [],
};

/**
 * Bundle with only patients for type-specific getter testing
 */
export const patientsOnlyBundle: Bundle = {
  resourceType: "Bundle",
  id: "test-bundle-patients-only",
  type: "collection",
  total: 3,
  entry: [
    {
      fullUrl: "urn:uuid:patient-001",
      resource: {
        resourceType: "Patient",
        id: "patient-001",
        name: [{ family: "First", given: ["Patient"] }],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:patient-002",
      resource: {
        resourceType: "Patient",
        id: "patient-002",
        name: [{ family: "Second", given: ["Patient"] }],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:patient-003",
      resource: {
        resourceType: "Patient",
        id: "patient-003",
        name: [{ family: "Third", given: ["Patient"] }],
      } as Patient,
    },
  ],
};

/**
 * Invalid bundle - wrong resourceType
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const invalidBundleWrongType: any = {
  resourceType: "Patient", // Should be Bundle
  id: "invalid-bundle",
  type: "collection",
};

/**
 * Bundle for export testing with mixed resource types
 */
export const mixedResourceTypesBundle: Bundle = {
  resourceType: "Bundle",
  id: "test-bundle-mixed",
  type: "collection",
  total: 6,
  entry: [
    {
      fullUrl: "urn:uuid:patient-mix-1",
      resource: {
        resourceType: "Patient",
        id: "patient-mix-1",
        name: [{ family: "Mix", given: ["Patient", "One"] }],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:patient-mix-2",
      resource: {
        resourceType: "Patient",
        id: "patient-mix-2",
        name: [{ family: "Mix", given: ["Patient", "Two"] }],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:observation-mix-1",
      resource: {
        resourceType: "Observation",
        id: "observation-mix-1",
        status: "final",
        code: { text: "Test Observation 1" },
        subject: { reference: "Patient/patient-mix-1" },
      } as Observation,
    },
    {
      fullUrl: "urn:uuid:observation-mix-2",
      resource: {
        resourceType: "Observation",
        id: "observation-mix-2",
        status: "final",
        code: { text: "Test Observation 2" },
        subject: { reference: "Patient/patient-mix-1" },
      } as Observation,
    },
    {
      fullUrl: "urn:uuid:practitioner-mix",
      resource: {
        resourceType: "Practitioner",
        id: "practitioner-mix",
        name: [{ family: "Mix", given: ["Practitioner"] }],
      } as Practitioner,
    },
    {
      fullUrl: "urn:uuid:encounter-mix",
      resource: {
        resourceType: "Encounter",
        id: "encounter-mix",
        status: "finished",
        class: { code: "AMB" },
        subject: { reference: "Patient/patient-mix-1" },
      } as Encounter,
    },
  ],
};
