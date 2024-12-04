import { Bundle } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { capture, out } from "../../../util";
import { base64ToString } from "../../../util/base64";
import { findDiagnosticReportResources, findPatientResource } from "../../fhir/shared";
import { BedrockUtils } from "../bedrock";

const MAXIMUM_BRIEF_STRING_LENGTH = 500_000;

const relevantResources = ["DiagnosticReport", "Patient"];

export type Brief = {
  id: string;
  content: string;
  link: string;
};

function getBedrockUtilsInstance(): BedrockUtils {
  return new BedrockUtils();
}

export async function bundleToBrief(
  fhirBundle: Bundle,
  cxId: string,
  patientId: string
): Promise<string | undefined> {
  const { log } = out(`AI Brief for cx ${cxId}, patient ${patientId}`);
  let processedBundleInput = await prepareBundleForBrief(fhirBundle);
  if (!processedBundleInput) return undefined;

  if (processedBundleInput.length > MAXIMUM_BRIEF_STRING_LENGTH) {
    const initialLength = processedBundleInput.length;
    processedBundleInput = processedBundleInput.slice(0, MAXIMUM_BRIEF_STRING_LENGTH);
    const msg = `Brief string input was truncated`;
    log(`${msg}. Initial length was: ${initialLength}`);
    capture.message(msg, {
      extra: {
        patientId,
        cxId,
        stringLength: processedBundleInput.length,
        maximumLength: MAXIMUM_BRIEF_STRING_LENGTH,
      },
      level: "info",
    });
  }

  const todaysDate = new Date().toISOString().split("T")[0];
  const bedrockUtils = getBedrockUtilsInstance();

  // TODO: Use AppConfig for the prompt string. Maybe use a different prompt for different customers.
  const prompt = `Today's date is ${todaysDate}. I'm a physician who works with elderly patients (65+). Write a short summary of the patient's well-being that is relevant today. Focus on any diagnoses that occurred in the past few years, and might require immediate attention. In your first sentence, include the patient's gender and age (today's date minus date of birth), and all significant medical conditions. In the next 2-3 sentences, summarize any notable recent health events (eg hospitalizations or emergency department visits). In the response, don't provide lists, and don't give me instructions. If not yet stated, add some context on the most recent developments in the patient's health (with specific dates).`;
  // const prompt1 = `Today's date is ${todaysDate}. Write a short summary of the patient's well-being that is relevant today. Be specific with the dates for any significant events. Focus on any diagnoses that occurred in the past year.`;
  // const prompt2 = `Today's date is ${todaysDate}. Given the attached medical documents, summarize them into a concise summary of the patients medical history. In your first sentence, include the patient's age/gender and all significant medical conditions. In the second sentence, summarize any notable recent health events (eg hospitalizations or emergency department visits) and any requested follow-up. Do not include directions on taking medications. Here is an example of an ideal summary: Patient is a 65 yo male with hx of HTN, poorly controlled diabetes, and smoking who presented with 3 hours of crushing substernal chest pain. They underwent a cardiac cath with stent placement and were discharged on aspirin and metoprolol.`;
  const body = processedBundleInput;
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
  const bundleCopy = cloneDeep(bundle);

  if (!bundle.entry?.length) return undefined;
  const dedupedBundle = deduplicateBundleResources(bundleCopy);
  if (!dedupedBundle.entry?.length) return undefined;
  const filteredString = filterBundleResources(dedupedBundle);
  if (!filteredString) return undefined;
  return (await preprocessDataWithRag(filteredString)).trim();
}

function deduplicateBundleResources(bundle: Bundle): Bundle {
  // TODO: Implement FHIR deduplication algorithm
  return bundle;
}

function filterBundleResources(bundle: Bundle): string | undefined {
  // TODO: Implement a filter for only including inputs within a certain time frame
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
  if (!patient) return undefined;
  const ptData = `Patient's family name: ${patient.name?.[0]?.family}, given: ${patient.name?.[0]?.given}, date of birth: ${patient.birthDate}`;
  const diagnosticReports = findDiagnosticReportResources(bundle);

  const sortedByDateDesc = diagnosticReports.sort((a, b) => {
    if (a.effectivePeriod?.start && b.effectivePeriod?.start) {
      return (
        new Date(b.effectivePeriod.start).getTime() - new Date(a.effectivePeriod.start).getTime()
      );
    }
    return 0;
  });

  const drData = sortedByDateDesc.map(dr =>
    dr.presentedForm?.map(pf => pf.data && base64ToString(pf.data)).join("\n")
  );

  const filteredString = `
    ${ptData}
    ${drData}
  `;

  return filteredString;
}

async function preprocessDataWithRag(inputString: string): Promise<string> {
  // TODO: Implement the pre-filter using a RAG model
  return inputString;
}
