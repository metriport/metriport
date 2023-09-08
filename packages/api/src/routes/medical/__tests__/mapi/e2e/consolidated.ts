import { Bundle } from "@medplum/fhirtypes";

export const createConsolidated = (patientId: string): Bundle => ({
  resourceType: "Bundle",
  type: "collection",
  entry: [
    {
      resource: {
        resourceType: "AllergyIntolerance",
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"],
        },
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: "active",
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
              code: "confirmed",
            },
          ],
        },
        type: "allergy",
        category: ["environment"],
        criticality: "low",
        code: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "419199007",
              display: "Allergy to substance (finding)",
            },
          ],
          text: "Allergy to substance (finding)",
        },
        patient: {
          reference: `Patient/${patientId}`,
        },
        recordedDate: "2010-09-03T03:10:10-05:00",
      },
    },
  ],
});
