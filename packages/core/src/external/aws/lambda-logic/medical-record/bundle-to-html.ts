import { Bundle, Resource, ResourceType, Patient } from "@medplum/fhirtypes";
import { formatDateForDisplay, Filter, defaultFilters } from "./shared";
// import { Brief } from "../bundle-to-brief";
import { tableOfContents } from "./table-of-contents";
import { createPatientDemographics } from "./patient-demographics";
import { buildPageHeader } from "./mr-header";
import { createNotesSections } from "./sections/notes/section";
import { createConditionsSections } from "./sections/conditions/section";
import { createMedicationsSections } from "./sections/medications/section";
import { createAllergiesSections } from "./sections/allergies/section";
import { createProceduresSections } from "./sections/procedures/section";
import { createSocialHistorySections } from "./sections/social-histroy/section";
import { createVitalsSections } from "./sections/vitals/section";
import { createLabsSections } from "./sections/labs/section";
import { createObservationsSections } from "./sections/observations/section";
import { createImmunizationsSections } from "./sections/immunizations/section";
import { createFamilyHistorySections } from "./sections/family-history/section";
import { createRelatedPersonsSections } from "./sections/related-persons/section";
import { createCoveragesSections } from "./sections/coverages/section";
import { createEncountersSections } from "./sections/encounters/section";
import { mrScripts } from "./mr-scripts";

export function bundleToHtml(
  fhirBundle: Bundle,
  filters: Filter[] = defaultFilters
  // brief?: Brief
): string {
  return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
      ${buildPageHeader()}
      ${buildPageBody(
        fhirBundle,
        filters
        // brief
      )}
    </html>
  `;
}

function buildPageBody(
  fhirBundle: Bundle,
  filters: Filter[]
  // brief?: Brief
): string {
  const groupedResources = groupSectionsByFhirResource(fhirBundle);
  const patient = groupedResources.Patient?.[0] as Patient;

  if (!patient) {
    throw new Error("No patient found in bundle");
  }

  return `
      <body>
        <div class="container">
          ${buildContentHeader(patient, filters)}
          <div id="mr-sections">
            ${createNotesSections()}
            ${createConditionsSections()}
            ${createMedicationsSections()}
            ${createAllergiesSections()}
            ${createProceduresSections()}
            ${createSocialHistorySections()}
            ${createVitalsSections()}
            ${createLabsSections()}
            ${createObservationsSections()}
            ${createImmunizationsSections()}
            ${createFamilyHistorySections()}
            ${createRelatedPersonsSections()}
            ${createCoveragesSections()}
            ${createEncountersSections()}
          </div>
        </div>
        <script>
          ${mrScripts()}
        </script>
      </body>
  `;
}

// NEED TO PASS COMPANY NAME
function buildContentHeader(patient: Patient, filters: Filter[]): string {
  return `
    <div id="mr-header">
      <div class='logo-container'>
        <img src="https://raw.githubusercontent.com/metriport/metriport/develop/assets/logo.png" alt="Logo">
      </div>

      <div class="date">${formatDateForDisplay(new Date())}</div>

      <h1 class="title">
          <span class="company-name">[Your Company Name]</span>
          <span class="record-title">Medical Record Summary</span>
      </h1>
      <div class="title-underline"></div>

      ${createPatientDemographics(patient)}
      ${tableOfContents(filters)}
    </div>
  `;
}

function groupSectionsByFhirResource(fhirBundle: Bundle): Record<ResourceType, Resource[]> {
  if (!fhirBundle.entry) {
    throw new Error("No entries found in bundle");
  }

  return fhirBundle.entry.reduce((acc, entry) => {
    if (!entry.resource) {
      return acc;
    }

    const resourceType = entry.resource.resourceType;

    if (!acc[resourceType]) {
      acc[resourceType] = [];
    }

    acc[resourceType].push(entry.resource);

    return acc;
  }, {} as Record<ResourceType, Resource[]>);
}
