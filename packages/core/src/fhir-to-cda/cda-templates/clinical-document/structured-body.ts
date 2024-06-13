import { Bundle } from "@medplum/fhirtypes";
import { buildAllergies } from "../components/allergies";
import { buildEncounters } from "../components/encounters";
import { buildFamilyHistory } from "../components/family-history";
import { buildImmunizations } from "../components/immunizations";
import { buildMedications } from "../components/medications";
import { buildMentalStatus } from "../components/mental-status";
import { buildProblems } from "../components/problems";
import { buildResult } from "../components/results";
import { buildSocialHistory } from "../components/social-history";
import { buildVitalSigns } from "../components/vital-signs";

export function buildStructuredBody(fhirBundle: Bundle): unknown {
  const structuredBodySections = [
    buildResult(fhirBundle),
    buildSocialHistory(fhirBundle),
    buildMentalStatus(fhirBundle),
    buildMedications(fhirBundle),
    buildProblems(fhirBundle),
    buildAllergies(fhirBundle),
    buildEncounters(fhirBundle),
    buildImmunizations(fhirBundle),
    buildVitalSigns(fhirBundle),
    buildFamilyHistory(fhirBundle),
  ];

  return {
    structuredBody: {
      component: structuredBodySections.map(section => ({
        section: section,
      })),
    },
  };
}
