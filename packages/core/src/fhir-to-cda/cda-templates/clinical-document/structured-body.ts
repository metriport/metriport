import { Bundle } from "@medplum/fhirtypes";
import { buildAllergies } from "../components/allergies";
import { buildMentalStatus } from "../components/mental-status";
import { buildResult } from "../components/results";
import { buildSocialHistory } from "../components/social-history";
import { buildMedications } from "../components/medications";
import { buildProblems } from "../components/problems";

export function buildStructuredBody(fhirBundle: Bundle): unknown {
  const structuredBodySections = [
    buildResult(fhirBundle),
    buildSocialHistory(fhirBundle),
    buildMentalStatus(fhirBundle),
    buildMedications(fhirBundle),
    buildProblems(fhirBundle),
    buildAllergies(fhirBundle),
  ];

  const structuredBody = {
    structuredBody: {
      component: structuredBodySections.map(comp => ({
        section: comp?.component.section,
      })),
    },
  };
  return structuredBody;
}
