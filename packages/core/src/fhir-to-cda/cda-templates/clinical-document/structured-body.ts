import { Bundle } from "@medplum/fhirtypes";
import { buildMentalStatus } from "../components/mental-status";
import { buildResult } from "../components/results";
import { buildSocialHistory } from "../components/social-history";

export function buildStructuredBody(fhirBundle: Bundle): unknown {
  const structuredBodySections = [
    buildResult(fhirBundle),
    buildSocialHistory(fhirBundle),
    buildMentalStatus(fhirBundle),
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
