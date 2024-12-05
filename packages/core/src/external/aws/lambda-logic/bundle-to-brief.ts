import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import {
  Address,
  Bundle,
  CodeableConcept,
  Condition,
  EncounterDiagnosis,
  HumanName,
  Location,
  Medication,
  Observation,
  Organization,
  Patient,
  Quantity,
  Resource,
} from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import { elapsedTimeFromNow, ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { LLMChain, MapReduceDocumentsChain, StuffDocumentsChain } from "langchain/chains";
import { cloneDeep } from "lodash";
import { filterBundleByDate } from "../../../command/consolidated/consolidated-filter-by-date";
import { getDatesFromEffectiveDateTimeOrPeriod } from "../../../command/consolidated/consolidated-filter-shared";
import {
  findDiagnosticReportResources,
  findPatientResource,
} from "../../../external/fhir/shared/index";
import { out } from "../../../util";
import { uuidv7 } from "../../../util/uuid-v7";
import { analytics, EventTypes } from "../../analytics/posthog";
import { BedrockChat } from "../../langchain/bedrock/index";

const CHUNK_SIZE = 100_000;
const CHUNK_OVERLAP = 1000;
const relevantResources = [
  "AllergyIntolerance",
  "DiagnosticReport",
  "Immunization",
  "Location",
  "Procedure",
  "Medication",
  "MedicationAdministration",
  "MedicationRequest",
  "MedicationStatement",
  "Condition",
  "Observation",
  "Practitioner",
  "Organization",
];

const referenceResources = [
  "Practitioner",
  "Organization",
  "Observation", // maybe worth keeping..
  "Location",
];

const UNANSWERED_CALL = "unanswered call";
const SCHEDULING_CALL = "scheduling call";
const ADMIN_NOTE = "admin note";
const SCAN_REF_NOTE = "scan reference";

const REPORT_TYPES_BLACKLIST = [
  "instructions",
  "addendum",
  "nursing note",
  SCHEDULING_CALL,
  UNANSWERED_CALL,
  ADMIN_NOTE,
  SCAN_REF_NOTE,
];

const REMOVE_FROM_NOTE = [
  "xLabel",
  "5/5",
  "Â°F",
  "Â",
  "â¢",
  "documented in this encounter",
  "xnoIndent",
  "Formatting of this note might be different from the original.",
  "Formatting of this note is different from the original.",
  "Portions of the history and exam were entered using voice recognition software",
  "Images from the original note were not included.",
  "Minor syntax, contextual, and spelling errors may be related to the use of this software and were not intentional. If corrections are necessary, please contact provider.",
  "<content>",
  "</content>",
  "<root>",
  "</root>",
  "&lt;",
  "&gt;",
];

const documentVariableName = "text";

export type Brief = {
  id: string;
  content: string;
  link: string;
};
//--------------------------------
// AI-based brief generation
//--------------------------------
export async function summarizeFilteredBundleWithAI(
  bundle: Bundle<Resource>,
  cxId: string,
  patientId: string
): Promise<string | undefined> {
  const requestId = uuidv7();
  const startedAt = new Date();
  const { log } = out(`summarizeFilteredBundleWithAI - cxId ${cxId}, patientId ${patientId}`);
  // filter out historical data
  log(`Starting with requestId ${requestId}, and bundle length ${bundle.entry?.length}`);
  const latestReportDate = findDiagnosticReportResources(bundle)
    .flatMap(report => {
      return getDatesFromEffectiveDateTimeOrPeriod(report);
    })
    .filter((date): date is string => date !== undefined)
    .sort((a, b) => b.localeCompare(a))[0];
  const numHistoricalYears = 1;
  const initialDate = dayjs(latestReportDate) ?? dayjs();
  const dateFrom = initialDate.subtract(numHistoricalYears, "year").format(ISO_DATE);
  const filteredBundle = filterBundleByDate(bundle, dateFrom);
  const slimPayloadBundle = buildSlimmerPayload(filteredBundle);
  const inputString = JSON.stringify(slimPayloadBundle);

  // TODO: #2510 - experiment with different splitters
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const docs = await textSplitter.createDocuments([inputString ?? ""]);
  const totalTokensUsed = {
    input: 0,
    output: 0,
  };

  const llmSummary = new BedrockChat({
    model: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    temperature: 0,
    region: "us-east-1",
    callbacks: [
      {
        handleLLMEnd: output => {
          const usage = output.llmOutput?.usage;
          if (usage) {
            totalTokensUsed.input += usage.input_tokens;
            totalTokensUsed.output += usage.output_tokens;
          }
        },
      },
    ],
  });

  const todaysDate = new Date().toISOString().split("T")[0];
  const systemPrompt = "You are an expert primary care doctor.";

  const summaryTemplate = `
  ${systemPrompt}

  Today's date is ${todaysDate}.
  Your goal is to write a summary of the patient's most recent medical history, so that another doctor can understand the patient's medical history to be able to treat them effectively.
  Here is a portion of the patient's medical history:
  --------
  {${documentVariableName}}
  --------

  Write a summary of the patient's most recent medical history, considering the following goals:
  1. Specify whether a DNR or POLST form has been completed.
  2. Include a summary of the patient's most recent hospitalization, including the location of the hospitalization, the date of the hospitalization, the reason for the hospitalization, and the results of the hospitalization.
  3. Include a summary of the patient's current chronic conditions, allergies, and any previous surgeries.
  4. Include a summary of the patient's current medications, including dosages and frequency - do not include instructions on how to take the medications. Include any history of medication allergies or adverse reactions.
  5. Include any other relevant information about the patient's health.

  If any of the above information is not present, do not include it in the summary.
  Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

  SUMMARY:
  `;
  const SUMMARY_PROMPT = PromptTemplate.fromTemplate(summaryTemplate);
  const summaryChain = new LLMChain({
    llm: llmSummary as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    prompt: SUMMARY_PROMPT as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  const summaryTemplateRefined = `
  ${systemPrompt}

  Today's date is ${todaysDate}.
  Your goal is to write a summary of the patient's most recent medical history, so that another doctor can understand the patient's medical history to be able to treat them effectively.
  Here are the previous summaries written by you of sections of the patient's medical history:
  --------
  {${documentVariableName}}
  --------

  Combine these summaries into a single, comprehensive summary of the patient's most recent medical history in a single paragraph.

  Don't tell me that you are writing a summary, just write the summary. Also, don't tell me about any limitations of the information provided.

  SUMMARY:
  `;
  const SUMMARY_PROMPT_REFINED = PromptTemplate.fromTemplate(summaryTemplateRefined);
  const summaryChainRefined = new StuffDocumentsChain({
    llmChain: new LLMChain({
      llm: llmSummary as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      prompt: SUMMARY_PROMPT_REFINED as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
    documentVariableName,
  });

  const mapReduce = new MapReduceDocumentsChain({
    llmChain: summaryChain,
    combineDocumentChain: summaryChainRefined,
    documentVariableName,
    verbose: false,
  });

  const summary = (await mapReduce.invoke({
    input_documents: docs,
  })) as { text: string };

  const costs = calculateCostsBasedOnTokens(totalTokensUsed);

  const duration = elapsedTimeFromNow(startedAt);
  log(
    `Done. Finished in ${duration} ms. Input cost: ${costs.input}, output cost: ${costs.output}. Total cost: ${costs.total}`
  );

  console.log({
    requestId,
    patientId,
    startBundleSize: bundle.entry?.length,
    endBundleSize: slimPayloadBundle?.length,
    duration,
    costs,
  });
  analytics({
    distinctId: cxId,
    event: EventTypes.aiBriefGeneration,
    properties: {
      requestId,
      patientId,
      startBundleSize: bundle.entry?.length,
      endBundleSize: slimPayloadBundle?.length,
      duration,
      costs,
    },
  });
  if (!summary.text) return undefined;
  return summary.text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSlimmerPayload(bundle: Bundle): any[] | undefined {
  if (bundle.entry?.length === 0) return undefined;

  const patient = findPatientResource(bundle);
  if (!patient) return undefined;

  // First pass to remove a ton of useless stuff and apply resource-specific modifications
  const leanBundleEntries = buildSlimmerBundle(bundle);

  // Build a map of these lean resources for cross-referencing
  const resourceMap = new Map<string, Resource>();
  leanBundleEntries?.forEach(res => {
    if (!res || !res.id) return;
    const mapKey = `${res.resourceType}/${res.id}`;
    resourceMap.set(mapKey, res);
  });

  // Replace the references with actual data and collect references for embedded resources
  const containedResourceIdsSet = new Set<string>();
  const processedEntries = leanBundleEntries?.map(res => {
    const { updRes, ids } = replaceReferencesWithData(res, resourceMap);
    ids.forEach(id => containedResourceIdsSet.add(id));

    return updRes;
  });

  const withFilteredReports = filterOutDiagnosticReports(processedEntries);

  const containedResourceIds = Array.from(containedResourceIdsSet).flatMap(id => {
    const uuid = id.split("/").pop();
    if (uuid) return uuid;
    return [];
  });

  // Filter out embedded resources from the final bundle
  const filteredEntries = withFilteredReports?.flatMap(entry => {
    if (Object.keys(entry).length === 0) return []; // TODO: Check why {} not being removed
    if (referenceResources.includes(entry.resourceType)) return [];
    if (containedResourceIds.includes(entry.id)) return [];
    return {
      ...entry,
      id: undefined,
    };
  });

  delete patient.telecom;
  delete patient.address;
  delete patient.text;
  filteredEntries?.push(patient);

  return filteredEntries;
}

function buildSlimmerBundle(originalBundle: Bundle<Resource>) {
  const bundle = cloneDeep(originalBundle);

  const entries = bundle.entry?.flatMap(entry => {
    const resource = entry.resource;
    if (!resource) return [];
    if (!relevantResources.includes(resource.resourceType)) return [];

    const slimmerResource = removeUselessAttributes(resource);
    const slimResource = applyResourceSpecificFilters(slimmerResource);

    return slimResource ?? [];
  });

  return entries;
}

function removeUselessAttributes(res: Resource) {
  delete res.meta;
  if ("patient" in res) delete res.patient;
  if ("subject" in res) delete res.subject;
  if ("masterIdentifier" in res) delete res.masterIdentifier;
  if ("identifier" in res) delete res.identifier;
  if ("extension" in res) delete res.extension;
  if ("telecom" in res) delete res.telecom;
  if ("encounter" in res) delete res.encounter;

  // Remove unknown coding displays, empty arrays, and "unknown" string values recursively
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleanupObject = (obj: any): void => {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        const item = obj[i];
        if (
          item &&
          typeof item === "object" &&
          "system" in item &&
          "code" in item &&
          "display" in item &&
          item.display?.toLowerCase().includes("unknown")
        ) {
          obj.splice(i, 1);
        } else {
          cleanupObject(item);
        }
      }
      return;
    }

    for (const key in obj) {
      const value = obj[key];

      if (Array.isArray(value) && value.length === 0) {
        delete obj[key];
      } else if (typeof value === "string" && value.toLowerCase() === "unknown") {
        delete obj[key];
      } else if (
        value &&
        typeof value === "object" &&
        "system" in value &&
        "code" in value &&
        "display" in value &&
        value.display?.toLowerCase().includes("unknown")
      ) {
        delete obj[key];
      } else if (value && typeof value === "object") {
        cleanupObject(value);
        if (Object.keys(value).length === 0) {
          delete obj[key];
        }
      }
    }
  };

  cleanupObject(res);
  return res;
}

function getUniqueDisplays(
  concept: CodeableConcept | CodeableConcept[] | undefined
): string[] | undefined {
  if (!concept) return undefined;

  const uniqueDescriptors = new Set<string>();
  const concepts = toArray(concept);
  concepts.forEach(concept => {
    const text = concept.text;
    if (text) uniqueDescriptors.add(text.trim().toLowerCase());

    concept.coding?.forEach(coding => {
      if (coding.display) uniqueDescriptors.add(coding.display.trim().toLowerCase());
    });
  });

  if (uniqueDescriptors.size === 0) return undefined;
  return Array.from(uniqueDescriptors);
}

function getUniqueDisplaysString(
  concept: CodeableConcept | CodeableConcept[] | undefined
): string | undefined {
  return getUniqueDisplays(concept)?.join(", ");
}

function getLongestDisplay(
  concept: CodeableConcept | CodeableConcept[] | undefined
): string | undefined {
  if (!concept) return undefined;

  const uniqueDescriptors = new Set<string>();
  const concepts = toArray(concept);
  concepts.forEach(concept => {
    const text = concept.text;
    if (text) uniqueDescriptors.add(text.trim().toLowerCase());

    concept.coding?.forEach(coding => {
      if (coding.display) uniqueDescriptors.add(coding.display.trim().toLowerCase());
    });
  });

  if (uniqueDescriptors.size === 0) return undefined;
  return Array.from(uniqueDescriptors).reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
}

function cleanUpNote(note: string): string {
  return note
    .trim()
    .replace(new RegExp(REMOVE_FROM_NOTE.join("|"), "g"), "")
    .replace(/<ID>.*?<\/ID>/g, "")
    .replace(/<styleCode>.*?<\/styleCode>/g, "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\*{2,}/g, "*")
    .replace(/_{2,}/g, " ");
}

/**
 * This function applies filters to the resource based on its resourceType, and overwrites and/or creates new specific attributes,
 * making them into strings most of the time.
 *
 * TODO: #2510 - Break this function up into smaller functions, specific to each resourceType.
 *
 * @returns updated resources as any
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyResourceSpecificFilters(res: Resource): any | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updRes: any = cloneDeep(res);

  if (res.resourceType === "Patient") {
    updRes.name = getNameString(res.name);
  }

  if (res.resourceType === "AllergyIntolerance") {
    updRes.status = Array.from(
      new Set(res.clinicalStatus?.coding?.flatMap(coding => coding.code || []))
    ).join(", ");
    if (isUselessStatus(updRes.status)) delete updRes.status;
  }

  if (res.resourceType === "Immunization") {
    delete updRes.lotNumber;

    if (res.vaccineCode) {
      const resVaccineCodeString = JSON.stringify(res.vaccineCode).toLowerCase();
      if (
        resVaccineCodeString.includes("no data") ||
        resVaccineCodeString.includes("no immunization")
      ) {
        return undefined;
      }

      updRes.vaccineCode = getUniqueDisplaysString(res.vaccineCode);
    }
    if (res.site?.text) {
      updRes.site = res.site.text;
    }
    updRes.route = getUniqueDisplaysString(res.route);

    delete updRes.doseQuantity;
  }

  if (res.resourceType === "Practitioner") {
    const name = getNameString(res.name);
    updRes.name = name;

    const qualificationsText = getLongestDisplay(res.qualification?.[0]?.code);
    if (qualificationsText) updRes.qualification = qualificationsText;

    updRes.address = getAddressString(res.address);
  }

  if (res.resourceType === "Procedure") {
    const name = getUniqueDisplaysString(res.code);
    if (name) {
      updRes.name = name;
      if (name.includes("no data")) return undefined;
    }

    delete updRes.code;

    if (isUselessStatus(updRes.status)) delete updRes.status;

    delete updRes.reasonCode; // TODO: #2510 - Introduce term server lookup here
    delete updRes.report;
    delete updRes.note;
  }

  if (res.resourceType === "DiagnosticReport") {
    const mostDescriptiveType = getLongestDisplay(res.code);
    if (mostDescriptiveType) updRes.type = mostDescriptiveType;
    if (isUselessStatus(updRes.status)) delete updRes.status;

    const allTypes = getUniqueDisplays(res.code);
    if (allTypes) {
      let removeResource = false;
      allTypes.forEach(type => {
        if (
          REPORT_TYPES_BLACKLIST.includes(type) ||
          REPORT_TYPES_BLACKLIST.some(blacklistedType => type.includes(blacklistedType))
        )
          removeResource = true;
      });
      if (removeResource) return undefined;
    }

    const category = res.category
      ?.map(cat => cat.coding?.flatMap(coding => coding.display || []))
      .join(", ");
    if (category) updRes.category = category;

    if (res.presentedForm) {
      const uniqueData = new Set<string>();
      res.presentedForm.forEach(form => {
        if (form.data) {
          const rawData = Buffer.from(form.data, "base64").toString("utf-8");
          const cleanedData = cleanUpNote(rawData);
          uniqueData.add(cleanedData);
          if (cleanedData.toLowerCase().includes("appointment scheduling letter")) {
            updRes.type = SCHEDULING_CALL;
          } else if (
            cleanedData.toLowerCase().includes("unable to reach") ||
            cleanedData.toLowerCase().includes("left a message")
          ) {
            updRes.type = UNANSWERED_CALL;
          } else if (cleanedData.toLowerCase().includes("administrative note")) {
            updRes.type = ADMIN_NOTE;
          } else if (
            cleanedData.toLowerCase().includes("nonva note") &&
            cleanedData.toLowerCase().includes("refer to scanned")
          ) {
            updRes.type = SCAN_REF_NOTE;
          } else if (cleanedData.toLowerCase().includes("discharge summary")) {
            updRes.type = "discharge summary";
          }
        }
      });
      updRes.presentedForm = Array.from(uniqueData);
    }

    if (updRes.type && REPORT_TYPES_BLACKLIST.includes(updRes.type)) {
      return undefined;
    }

    delete updRes.code;
  }

  if (res.resourceType === "Observation") {
    if (res.category) {
      const category = getUniqueDisplaysString(res.category);
      if (category) updRes.category = category;
    }

    if (isUselessStatus(updRes.status)) delete updRes.status;

    const code = getUniqueDisplaysString(res.code);
    if (code) updRes.reading = code;

    if (res.valueCodeableConcept) {
      updRes.value = getUniqueDisplaysString(res.valueCodeableConcept);
      delete updRes.valueCodeableConcept;
    }

    if (res.valueQuantity) {
      updRes.value = getQuantityString(res.valueQuantity);
      delete updRes.valueQuantity;
    }

    if (res.interpretation) {
      updRes.interpretation = getUniqueDisplaysString(res.interpretation);
    }

    if (res.referenceRange) {
      updRes.referenceRange = res.referenceRange.map(range => {
        const low = getQuantityString(range.low);
        const high = getQuantityString(range.high);
        return {
          low,
          high,
        };
      });
    }

    delete updRes.code;
    delete updRes.performer;
  }

  if (res.resourceType === "Medication") {
    updRes.name = getUniqueDisplaysString(res.code);
    delete updRes.code;
  }

  if (res.resourceType === "MedicationRequest") {
    delete updRes.requester;
  }

  if (res.resourceType === "MedicationStatement") {
    if (res.dosage) {
      const dosages = res.dosage.flatMap(dosage => {
        const dose = getQuantityString(dosage.doseAndRate?.[0]?.doseQuantity);
        const route = getUniqueDisplaysString(dosage.route);
        if (!dose && !route) return [];
        return { dose, route };
      });
      if (dosages.length > 0) updRes.dosages = dosages;
      delete updRes.dosage;
    }
  }

  if (res.resourceType === "MedicationAdministration") {
    if (res.dosage) {
      const dose = getQuantityString(res.dosage.dose);
      if (dose) updRes.dose = dose;

      updRes.route = getUniqueDisplaysString(res.dosage.route);
      delete updRes.dosage;
    }
  }

  if (res.resourceType === "Condition") {
    updRes.name = getUniqueDisplaysString(res.code);
    delete updRes.code;

    updRes.category = getUniqueDisplaysString(res.category);

    updRes.clinicalStatus = getUniqueDisplaysString(res.clinicalStatus);
    if (isUselessStatus(updRes.clinicalStatus)) delete updRes.clinicalStatus;
  }

  if (res.resourceType === "AllergyIntolerance") {
    updRes.clinicalStatus = getUniqueDisplaysString(res.clinicalStatus);

    if (res.reaction) {
      updRes.reaction = res.reaction.map(reaction => {
        const manifestation = getUniqueDisplaysString(reaction.manifestation);
        const substance = getUniqueDisplaysString(reaction.substance);

        return {
          manifestation,
          substance,
        };
      });
    }

    delete updRes.recorder;
  }

  if (res.resourceType === "Organization") {
    updRes.address = getAddressString(res.address);
  }

  if (res.resourceType === "Location") {
    updRes.address = getAddressString(res.address);
    updRes.type = getUniqueDisplaysString(res.type);
  }

  return updRes;
}

function getQuantityString(quantity: Quantity | undefined): string | undefined {
  if (!quantity) return undefined;
  return `${quantity.value}${quantity.unit ? ` ${quantity.unit}` : ""}`;
}

function getAddressString(address: Address | Address[] | undefined): string | undefined {
  if (!address) return undefined;

  return toArray(address)
    .map(addr => `${addr.line}, ${addr.city}, ${addr.state}`)
    .join("\n");
}

/**
 * Takes a FHIR resource and replaces referenced resources with the actual contents of those resources.
 * This allows the context for a resource to be contained entirely within itself.
 * It also keeps track of the referenced resources, so those can later be removed from the bundle.
 *
 * @returns updated resource as any
 */
function replaceReferencesWithData(
  res: Resource,
  map: Map<string, Resource>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { updRes: any; ids: string[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updRes: any = cloneDeep(res);
  const referencedIds = new Set<string>();

  if ("payor" in res) {
    const ref = toArray(res.payor);
    const orgRefs = ref.filter(r => r.reference?.includes("Organization"));
    if (orgRefs.length > 0) {
      updRes.payor = [];
      orgRefs.map(org => {
        const refString = org.reference;
        if (refString) {
          const org = map.get(refString);
          referencedIds.add(refString);
          if (org && org.resourceType === "Organization") {
            updRes.payor.push(org.name);
          }
        }
      });
      updRes.payor = updRes.payor.join("; ");
    }
  }

  if ("beneficiary" in res) {
    const ref = res.beneficiary;
    if (ref.reference) {
      const refString = ref.reference;
      const pat = map.get(refString) as Patient | undefined;
      referencedIds.add(refString);
      if (pat && pat.resourceType === "Patient") {
        updRes.beneficiary = pat.name;
      }
    }
  }

  if ("diagnosis" in res) {
    if (res.resourceType === "Encounter") {
      const diagnoses = res.diagnosis as EncounterDiagnosis[];
      const diagnosesNames = diagnoses
        .flatMap(diag => {
          const refString = diag.condition?.reference;
          if (refString) {
            referencedIds.add(refString);
            const condition = map.get(refString) as Condition | undefined;
            if (condition) {
              const condName =
                `${condition.code?.text ?? ""}` +
                condition.code?.coding?.map(coding => coding.display).join(", ");

              return condName;
            }
          }
          return [];
        })
        .join(" ");

      updRes.diagnosis = diagnosesNames;
    }
  }

  if ("location" in res) {
    if (res.resourceType === "Encounter") {
      const locationRefs = res.location;
      updRes.location = locationRefs
        ?.map(locRef => {
          const refString = locRef.location?.reference;
          if (refString) {
            const loc = map.get(refString) as Location | undefined;
            referencedIds.add(refString);
            if (loc) {
              return loc.name ?? [];
            }
          }
          return [];
        })
        .join(", ");
    }
  }

  if ("participant" in res) {
    if (res.resourceType === "Encounter") {
      updRes.participant = res.participant?.flatMap(part => {
        const refString = part.individual?.reference;
        if (refString) {
          const individual = map.get(refString);
          referencedIds.add(refString);
          if (
            individual?.resourceType === "Practitioner" ||
            individual?.resourceType === "RelatedPerson"
          ) {
            return individual.name;
          }
        }
        return [];
      });
    }
  }

  if ("performer" in res) {
    if (res.performer) {
      if (
        res.resourceType === "DiagnosticReport" ||
        res.resourceType === "Observation" ||
        res.resourceType === "ServiceRequest"
      ) {
        const performers = toArray(res.performer);
        const orgs: string[] = [];
        const practitioners: string[] = [];

        performers.forEach(p => {
          const ref = p.reference;
          if (!ref) return;

          referencedIds.add(ref);
          const performer = map.get(ref);

          if (performer?.resourceType === "Organization") {
            const name = typeof performer.name === "string" ? performer.name : "";
            if (name.length > 0) orgs.push(name);
          } else if (performer?.resourceType === "Practitioner") {
            const name =
              typeof performer.name === "string" ? performer.name : getNameString(performer.name);
            if (name) practitioners.push(name);
          }
        });

        if (orgs.length > 0) updRes.org = orgs.join(", ");
        if (practitioners.length > 0) {
          updRes.performer = practitioners.join(", ");
        } else {
          delete updRes.performer;
        }
      } else if (
        res.resourceType === "Immunization" ||
        res.resourceType === "MedicationAdministration" ||
        res.resourceType === "MedicationDispense" ||
        res.resourceType === "MedicationRequest" ||
        res.resourceType === "Procedure"
      ) {
        const performers = toArray(res.performer);
        updRes.performer = performers
          ?.flatMap(perf => {
            const refString = perf.actor?.reference;
            if (refString) {
              const actor = map.get(refString);
              referencedIds.add(refString);
              if (actor && "name" in actor) {
                const name = actor.name;
                if (typeof name === "string") return name;
                return getNameString(name);
              }
            }
            return [];
          })
          .join(", ");
      }
    }
  }

  if ("serviceProvider" in res) {
    const refString = res.serviceProvider?.reference;
    if (refString) {
      const org = map.get(refString) as Organization | undefined;
      referencedIds.add(refString);
      if (org) {
        if (org.name) {
          updRes.serviceProvider = org.name;
        } else {
          delete updRes.serviceProvider;
        }
      }
    }
  }

  if ("result" in res) {
    if (res.resourceType === "DiagnosticReport") {
      updRes.results = res.result?.flatMap(resultRef => {
        const refString = resultRef.reference;
        if (refString) {
          const observation = map.get(refString) as Observation | undefined;
          referencedIds.add(refString);
          return {
            ...observation,
            resourceType: undefined,
            id: undefined,
          };
        }
        return [];
      });

      delete updRes.result;
    }
  }

  if ("medicationReference" in res) {
    const refString = res.medicationReference?.reference;
    if (refString) {
      const medication = map.get(refString) as Medication | undefined;
      referencedIds.add(refString);
      if (medication) {
        updRes.medication = { ...medication, id: undefined, resourceType: undefined };
        delete updRes.medicationReference;
      }
    }
  }

  if ("recorder" in res) {
    const refString = res.recorder?.reference;
    if (refString) {
      const individual = map.get(refString);
      referencedIds.add(refString);
      if (individual && individual.resourceType === "Practitioner") {
        updRes.practitioner = { ...individual, resourceType: undefined, id: undefined };
        delete updRes.recorder;
      }
    }
  }

  if ("manufacturer" in res && res.resourceType === "Immunization") {
    if (res.manufacturer) {
      if (res.manufacturer.display) {
        updRes.manufacturer = res.manufacturer.display;
      } else if (res.manufacturer.reference) {
        const refString = res.manufacturer.reference;
        const org = map.get(refString);
        referencedIds.add(refString);

        if (org) {
          updRes.manufacturer = { ...org, id: undefined };
        }
      }
    }
  }

  return { updRes, ids: Array.from(referencedIds) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterOutDiagnosticReports(entries: any[] | undefined): any[] | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reports: any[] = [];
  const otherEntries = entries?.filter(entry => {
    if (entry.resourceType === "DiagnosticReport") {
      reports.push(entry);
      return false;
    }
    return true;
  });
  const withOnlyLatestLabs = filterOutOldLabs(reports);
  const withLimitedReportsPerPerformer = filterReportsByPerformerAndCategory(withOnlyLatestLabs);
  const withoutDuplicateReports = filterOutDuplicateReports(withLimitedReportsPerPerformer);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: any[] = [];
  if (withoutDuplicateReports && withoutDuplicateReports.length > 0) {
    ret.push(...withoutDuplicateReports);
  }
  if (otherEntries && otherEntries.length > 0) ret.push(...otherEntries);
  return ret;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterOutOldLabs(reports: any[] | undefined): any[] | undefined {
  const NUM_MOST_RECENT_LABS_TO_KEEP = 2;

  if (!reports) return undefined;

  const labReports = reports.filter(report =>
    report.category?.toLowerCase().includes("relevant diagnostic tests and/or laboratory data")
  );
  const nonLabReports = reports.filter(report => !report.category?.includes("laboratory data"));

  const sortedLabReports = labReports.sort((a, b) => {
    const aDates = getDatesFromEffectiveDateTimeOrPeriod(a);
    const bDates = getDatesFromEffectiveDateTimeOrPeriod(b);

    const aDate = aDates.find(d => d !== undefined);
    const bDate = bDates.find(d => d !== undefined);

    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.localeCompare(aDate);
  });

  const recentLabReports = sortedLabReports.slice(0, NUM_MOST_RECENT_LABS_TO_KEEP);

  return [...recentLabReports, ...nonLabReports];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterReportsByPerformerAndCategory(reports: any[] | undefined): any[] | undefined {
  if (!reports) return undefined;
  const MAX_REPORTS_PER_GROUP = 3;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportGroups = new Map<string, any[]>();

  reports.forEach(report => {
    const performer = report.performer ?? "unknown";
    const type = report.type ?? "unknown";
    const key = `${performer}|${type}`;

    if (!reportGroups.has(key)) {
      reportGroups.set(key, []);
    }
    reportGroups.get(key)?.push(report);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredReports: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const garbageCollector: any[] = [];

  reportGroups.forEach(group => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedGroup = group.sort((a: any, b: any) => {
      const aDates = getDatesFromEffectiveDateTimeOrPeriod(a);
      const bDates = getDatesFromEffectiveDateTimeOrPeriod(b);

      const aDate = aDates.find(d => d !== undefined);
      const bDate = bDates.find(d => d !== undefined);

      if (!aDate) return 1;
      if (!bDate) return -1;
      return bDate.localeCompare(aDate);
    });

    filteredReports.push(...sortedGroup.slice(0, MAX_REPORTS_PER_GROUP));
    garbageCollector.push(...sortedGroup.slice(MAX_REPORTS_PER_GROUP));
  });

  return filteredReports;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterOutDuplicateReports(reports: any[] | undefined): any[] | undefined {
  const formDataSet = new Set<string>();
  return reports?.filter(entry => {
    if (entry.presentedForm) {
      const newPresentedForm: string[] = [];
      entry.presentedForm.forEach((text: string) => {
        const sentences = text
          .split(/[.\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        const filteredSentences = sentences.filter(sentence => {
          if (formDataSet.has(sentence)) {
            return false;
          }
          formDataSet.add(sentence);
          return true;
        });
        newPresentedForm.push(filteredSentences.join(". "));
      });

      const filsss = newPresentedForm.join("\n");
      if (filsss.length === 0) {
        return false;
      }
    }
    return true;
  });
}

function getNameString(names: HumanName | HumanName[] | undefined): string | undefined {
  const nameParts = new Set<string>();
  toArray(names).forEach(name => {
    delete name.use;
    name.given?.forEach(given => nameParts.add(given.trim()));
    name.family && nameParts.add(name.family?.trim());
  });

  return Array.from(nameParts).join(" ");
}

function isUselessStatus(status: string): boolean {
  return status === "" || status === "final";
}

function calculateCostsBasedOnTokens(totalTokens: { input: number; output: number }): {
  input: number;
  output: number;
  total: number;
} {
  const input = (totalTokens.input / 1000) * 0.0015;
  const output = (totalTokens.output / 1000) * 0.0075;
  const total = input + output;

  return { input, output, total };
}
