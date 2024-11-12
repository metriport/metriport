import { Bundle, Patient } from "@medplum/fhirtypes";
import { formatDateForDisplay, Filter, defaultFilters } from "./shared";
// import { Brief } from "../bundle-to-brief";
import { tableOfContents } from "./table-of-contents";
import { createPatientDemographics } from "./patient-demographics";
import { buildPageHeader } from "./mr-header";
import { mrScripts } from "./mr-scripts";
import {
  groupSectionsByFhirResource,
  getResourcesFromBundle,
  filterToComponentMap,
} from "./shared";

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
  const mappedResources = groupSectionsByFhirResource(fhirBundle);
  const patients = getResourcesFromBundle<Patient>(mappedResources, "Patient");
  const patient = patients[0];

  if (patients.length > 1) {
    throw new Error("Multiple patients found in bundle");
  } else if (!patient) {
    throw new Error("No patient found in bundle");
  }

  return `
      <body>
        <div class="container">
          ${buildContentHeader(patient, filters)}
          <div id="mr-sections">
            ${filters
              .map(filter => filterToComponentMap[filter.key](mappedResources, filter))
              .join("")}
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
