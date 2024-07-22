import { Bundle } from "@medplum/fhirtypes";
import { findDiagnosticReportResources, findPatientResource } from "../../fhir/shared";
import { BedrockUtils } from "../bedrock";

const relevantResources = [
  // "AllergyIntolerance",
  // "Condition",
  "DiagnosticReport",
  // "FamilyMemberHistory",
  // "MedicationStatement", // might be interested.. could filter for active medication and dosage?
  // "Medication", // maybe only get the ones referenced by MedStmnt and only use code.text?
  "Patient", // only keep name, gender, dob
  // "Procedure", // potentially useful, but need to filter heavily
];

// const irrelevantResources = [
//   "Coverage",
//   "Consent",
//   "Composition",
//   "DocumentReference",
//   "Encounter",
//   // "Immunization", // not interested imo
//   // "MedicationAdministration", // probably not interested, but could keep the latest ones?
//   "MedicationRequest",
//   "Organization", // ???
//   "Observation", // Very prevalent. Very concise and don't provide much value imo. OTOH, we could maybe filter out a ton of irrelevant ones and keep ones that could be useful.
//   "RelatedPerson",
//   "Practitioner",
//   "Device",
//   "Location",
// ];
function getBedrockUtilsInstance(): BedrockUtils {
  return new BedrockUtils();
}

export async function bundleToBrief(fhirBundle: Bundle): Promise<string | undefined> {
  const briefBundle = await prepareBundleForBrief(fhirBundle);
  if (!briefBundle) return undefined;

  const bedrockUtils = getBedrockUtilsInstance();
  const prompt =
    "Write a short summary of the patient's well-being that is relevant today. Be specific with the dates for any significant events. Provide the lates vitals if they're abnormal. Focus on any diagnoses that occurred in the past year.";
  const body = JSON.stringify(briefBundle);
  try {
    return await bedrockUtils.getBedrockResponse({
      prompt,
      body,
    });
  } catch (error) {
    return undefined;
  }
}

export async function prepareBundleForBrief(bundle: Bundle): Promise<string | undefined> {
  if (!bundle.entry?.length) return undefined;
  const dedupedBundle = deduplicateBundleResources(bundle);
  if (!dedupedBundle.entry?.length) return undefined;
  const filteredString = filterBundleResources(dedupedBundle);
  if (!filteredString) return undefined;
  return await preprocessDataWithRag(filteredString);
}

function deduplicateBundleResources(bundle: Bundle): Bundle {
  // TODO: Implement deduplication algorithm
  return bundle;
}

function filterBundleResources(bundle: Bundle): string | undefined {
  const entries = bundle.entry;
  const filteredEntries = entries?.filter(entry => {
    const resource = entry.resource;
    if (resource && relevantResources.includes(resource.resourceType)) {
      return true;
    }
    return false;
  });

  if (!filteredEntries) return undefined;
  bundle.entry = filteredEntries;

  const patient = findPatientResource(bundle);
  const ptData = patient
    ? JSON.stringify(
        `PT family name: ${JSON.stringify(patient.name?.[0]?.family)}, given: ${
          patient.name?.[0]?.given
        })}, DOB: ${patient.birthDate}`
      )
    : undefined;

  const diagnosticReports = findDiagnosticReportResources(bundle);
  const drData = diagnosticReports.map(dr =>
    JSON.stringify(dr.presentedForm?.map(pf => pf.data).join("\n"))
  );

  const context = `Today is ${new Date().toISOString()}`;
  const filteredString = `
    ${context}
    ${ptData}
    ${drData}
  `;

  return JSON.stringify(filteredString);
}

async function preprocessDataWithRag(inputString: string): Promise<string> {
  // TODO: Implement the pre-filter using a RAG model
  return inputString;
}
