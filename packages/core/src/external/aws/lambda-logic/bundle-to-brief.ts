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
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { LLMChain, MapReduceDocumentsChain, StuffDocumentsChain } from "langchain/chains";
import { cloneDeep } from "lodash";
import { filterBundleByDate } from "../../../command/consolidated/consolidated-filter-by-date";
import { findPatientResource } from "../../../external/fhir/shared/index";
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
  bundle: Bundle<Resource>
): Promise<string | undefined> {
  // filter out historical data
  const numHistoricalYears = 2;
  const dateFrom = dayjs().subtract(numHistoricalYears, "year").format(ISO_DATE);
  const filteredBundle = filterBundleByDate(bundle, dateFrom);

  const inputString = prepareBundleForBrief(filteredBundle);

  // TODO: #2510 - experiment with different splitters
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const docs = await textSplitter.createDocuments([inputString ?? ""]);

  const llmSummary = new BedrockChat({
    model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    temperature: 0,
    region: "us-east-1",
  });

  const todaysDate = new Date().toISOString().split("T")[0];
  const systemPrompt = "You are an expert primary care doctor.";

  // TODO: #2516 - experiment with different prompts
  // this is the summary prompt for each chunk of the bundle
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

  // this is the prompt for combining the summaries into a single paragraph
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
    verbose: true,
  });

  const summary = (await mapReduce.invoke({
    input_documents: docs,
  })) as { text: string };

  if (!summary.text) return undefined;
  return summary.text;
}

export function prepareBundleForBrief(bundle: Bundle): string | undefined {
  if (bundle.entry?.length === 0) return undefined;
  const filteredString = filterBundleResources(bundle);
  return filteredString;
}

function filterBundleResources(bundle: Bundle) {
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

  const containedResourceIds = Array.from(containedResourceIdsSet).flatMap(id => {
    const uuid = id.split("/").pop();
    if (uuid) return uuid;
    return [];
  });

  // Filter out embedded resources from the final bundle
  const filteredEntries = processedEntries?.flatMap(entry => {
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

  console.log(`Started with ${bundle.entry?.length} resource`);
  console.log(`Processed to keep ${processedEntries?.length} resources`);
  console.log(`And filtered down to ${filteredEntries?.length} resources`);
  return JSON.stringify(filteredEntries);
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
  return Array.from(uniqueDescriptors).join(", ");
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
    if (updRes.status === "") delete updRes.status;
  }

  if (res.resourceType === "Immunization") {
    delete res.lotNumber;

    if (res.vaccineCode) {
      const resVaccineCodeString = JSON.stringify(res.vaccineCode).toLowerCase();
      if (
        resVaccineCodeString.includes("no data") ||
        resVaccineCodeString.includes("no immunization")
      ) {
        return undefined;
      }

      updRes.vaccineCode = getUniqueDisplays(res.vaccineCode);
    }

    delete res.doseQuantity;
  }

  if (res.resourceType === "Practitioner") {
    const name = getNameString(res.name);
    updRes.name = name;

    const qualificationsText = getUniqueDisplays(res.qualification?.[0]?.code);
    if (qualificationsText) updRes.qualification = qualificationsText;

    updRes.address = getAddressString(res.address);
  }

  if (res.resourceType === "Procedure") {
    const name = getUniqueDisplays(res.code);
    if (name) {
      updRes.name = name;
      if (name.includes("no data")) return undefined;
    }

    delete updRes.code;

    if (updRes.status === "") delete updRes.status;

    delete res.reasonCode; // TODO: #2510 - Introduce term server lookup here
  }

  if (res.resourceType === "DiagnosticReport") {
    const code = res.code?.text;
    if (code) updRes.code = code;

    const category = res.category
      ?.map(cat => cat.coding?.flatMap(coding => coding.display || []))
      .join(", ");
    if (category) updRes.category = category;

    if (res.presentedForm) {
      updRes.presentedForm = res.presentedForm.map(form => {
        delete form.contentType;
        if (form.data) {
          form.data = Buffer.from(form.data, "base64").toString("utf-8");
        }
        return form;
      });
    }
  }

  if (res.resourceType === "Observation") {
    if (res.category) {
      const category = getUniqueDisplays(res.category);
      if (category) updRes.category = category;
    }

    const code = getUniqueDisplays(res.code);
    if (code) updRes.reading = code;

    if (res.valueCodeableConcept) {
      updRes.value = getUniqueDisplays(res.valueCodeableConcept);
      delete updRes.valueCodeableConcept;
    }

    if (res.valueQuantity) {
      updRes.value = getQuantityString(res.valueQuantity);
      delete updRes.valueQuantity;
    }

    if (res.interpretation) {
      updRes.interpretation = getUniqueDisplays(res.interpretation);
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
    updRes.name = getUniqueDisplays(res.code);
    delete res.code;
  }

  if (res.resourceType === "MedicationRequest") {
    delete updRes.requester;
  }

  if (res.resourceType === "MedicationAdministration") {
    if (res.dosage) {
      const dose = getQuantityString(res.dosage.dose);
      if (dose) updRes.dose = dose;

      updRes.route = getUniqueDisplays(res.dosage.route);
      delete updRes.dosage;
    }
  }

  if (res.resourceType === "Condition") {
    updRes.name = getUniqueDisplays(res.code);
    delete updRes.code;

    updRes.category = getUniqueDisplays(res.category);

    updRes.clinicalStatus = getUniqueDisplays(res.clinicalStatus);
    if (updRes.clinicalStatus === "") delete updRes.clinicalStatus;
  }

  if (res.resourceType === "AllergyIntolerance") {
    updRes.clinicalStatus = getUniqueDisplays(res.clinicalStatus);

    if (res.reaction) {
      updRes.reaction = res.reaction.map(reaction => {
        const manifestation = getUniqueDisplays(reaction.manifestation);
        const substance = getUniqueDisplays(reaction.substance);

        return {
          manifestation,
          substance,
        };
      });
    }

    delete res.recorder;
  }

  if (res.resourceType === "Organization") {
    updRes.address = getAddressString(res.address);
  }

  if (res.resourceType === "Location") {
    updRes.address = getAddressString(res.address);
    updRes.type = getUniqueDisplays(res.type);
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
    if (Array.isArray(res.performer)) {
      if (
        res.resourceType === "DiagnosticReport" ||
        res.resourceType === "Observation" ||
        res.resourceType === "ServiceRequest"
      ) {
        updRes.performer = res.performer
          .flatMap(p => {
            const ref = p.reference;
            if (ref) {
              referencedIds.add(ref);
              const performer = map.get(ref);
              if (
                performer?.resourceType === "Organization" ||
                performer?.resourceType === "Practitioner"
              ) {
                if (typeof performer.name === "string") return performer.name;
                return getNameString(performer.name);
              }
            }
            return [];
          })
          .join(", ");
      } else if (
        res.resourceType === "Immunization" ||
        res.resourceType === "MedicationAdministration" ||
        res.resourceType === "MedicationDispense" ||
        res.resourceType === "MedicationRequest" ||
        res.resourceType === "Procedure"
      ) {
        if (Array.isArray(res.performer)) {
          updRes.performer = res.performer
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
        updRes.practitioner = { ...individual, id: undefined };
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

  return { updRes: res, ids: Array.from(referencedIds) };
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
