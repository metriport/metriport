import { AllergyIntolerance } from "@medplum/fhirtypes";
import { uuidv7 } from "../../../util/uuid-v7";
import { PatientWithId } from "./patient";

export function makeAllergyIntollerance({
  patient,
}: {
  patient: PatientWithId;
}): AllergyIntolerance {
  return {
    resourceType: "AllergyIntolerance",
    id: uuidv7(),
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
    reaction: [
      {
        manifestation: [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "271807003",
                display: "Eruption of skin (disorder)",
              },
            ],
            text: "Eruption of skin (disorder)",
          },
        ],
        substance: {
          text: "Pollen",
        },
      },
    ],
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
      reference: `Patient/${patient.id}`,
    },
    recordedDate: "2010-09-03T03:10:10-05:00",
  };
}
