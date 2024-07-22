import { Bundle } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { capture, out } from "../../../util";
import { findDiagnosticReportResources, findPatientResource } from "../../fhir/shared";
import { BedrockUtils } from "../bedrock";

const MAXIMUM_BRIEF_STRING_LENGTH = 17_500;

const relevantResources = ["DiagnosticReport", "Patient"];

function getBedrockUtilsInstance(): BedrockUtils {
  return new BedrockUtils();
}

export async function bundleToBrief(
  fhirBundle: Bundle,
  cxId: string,
  patientId: string
): Promise<string | undefined> {
  const { log } = out(`MR Brief for cx ${cxId}, patient ${patientId}`);
  let briefString = await prepareBundleForBrief(fhirBundle);
  if (!briefString) return undefined;

  if (briefString.length > MAXIMUM_BRIEF_STRING_LENGTH) {
    briefString = briefString.slice(0, MAXIMUM_BRIEF_STRING_LENGTH);
    const msg = `Brief string input was truncated`;
    log(msg);
    capture.message(msg, {
      extra: {
        patientId,
        cxId,
        stringLength: briefString.length,
        maximumLength: MAXIMUM_BRIEF_STRING_LENGTH,
      },
      level: "info",
    });
  }

  const todaysDate = new Date().toISOString().split("T")[0];
  const bedrockUtils = getBedrockUtilsInstance();
  const prompt = `Today's date is ${todaysDate}. Write a short summary of the patient's well-being that is relevant today. Be specific with the dates for any significant events. Focus on any diagnoses that occurred in the past year.`;
  const body = JSON.stringify(briefString);
  try {
    const brief = bedrockUtils.getBedrockResponse({
      prompt,
      body,
    });
    log(`Brief generated.`);
    return brief;
  } catch (error) {
    log(`Error generating brief: ${errorToString(error)}`);
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

  const filteredString = `
    ${ptData}
    ${drData}
  `;

  return JSON.stringify(filteredString);
}

async function preprocessDataWithRag(inputString: string): Promise<string> {
  // TODO: Implement the pre-filter using a RAG model
  return inputString;
}
