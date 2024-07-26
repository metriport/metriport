import { Bundle } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { capture, out } from "../../../util";
import { findDiagnosticReportResources, findPatientResource } from "../../fhir/shared";
import { BedrockUtils } from "../bedrock";
import fs from "fs";
import { base64ToString } from "../../../util/base64";

const MAXIMUM_BRIEF_STRING_LENGTH = 525_000;

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
    fs.writeFileSync("test-input.txt", briefString);
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
  // const prompt2 = `Today's date is ${todaysDate}. Given the attached medical documents, summarize them into a concise summary of the patients medical history. In your first sentence, include the patient's age/gender and all significant medical conditions. In the second sentence, summarize any notable recent health events (eg hospitalizations or emergency department visits) and any requested follow-up. Do not include directions on taking medications. Here is an example of an ideal summary: Patient is a 65 yo male with hx of HTN, poorly controlled diabetes, and smoking who presented with 3 hours of crushing substernal chest pain. They underwent a cardiac cath with stent placement and were discharged on aspirin and metoprolol.`;
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
  // TODO: Implement FHIR deduplication algorithm
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

  const sortedByDate = diagnosticReports.sort((a, b) => {
    if (a.effectivePeriod?.start && b.effectivePeriod?.start) {
      return (
        new Date(b.effectivePeriod.start).getTime() - new Date(a.effectivePeriod.start).getTime()
      );
    }
    return 0;
  });

  const drData = sortedByDate.map(dr =>
    JSON.stringify(dr.presentedForm?.map(pf => pf.data && base64ToString(pf.data)).join("\n"))
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
