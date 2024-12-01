/* eslint-disable */
// @ts-nocheck
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BedrockChat } from "@langchain/community/chat_models/bedrock";
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
import { findPatientResource } from "@metriport/core/external/fhir/shared/index";
import { toArray } from "@metriport/shared";
import fs from "fs";
import { loadSummarizationChain } from "langchain/chains";
import { cloneDeep } from "lodash";
import { filterConsolidated } from "@metriport/core/command/consolidated/consolidated-filter";

const SOURCE_DIR = "/Users/dgoncharov/Documents/phi/ai-brief";
const SOURCE_PATIENT_ID = "xxxx";
const SOURCE_BUNDLE_FILE = `${SOURCE_PATIENT_ID}.json`;
const BRIEF_BUNDLE_FILE = `briefed-${SOURCE_PATIENT_ID}.json`;
const CHUNK_SIZE = 10000;
const CHUNK_OVERLAP = 250;
const relevantResources = [
  "AllergyIntolerance",
  // "Coverage",
  "DiagnosticReport",
  // "Encounter",
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
  "Patient",
];

const referenceResources = [
  "Practitioner",
  "Organization",
  "Observation", // maybe worth keeping..
  "Location",
];

//--------------------------------
// AI-based brief generation
//--------------------------------
async function summarizeFilteredBundleWithAI(saveBriefedBundle: boolean = false) {
  // read filtered bundle from file
  const fileName = `${SOURCE_DIR}/${BRIEF_BUNDLE_FILE}`;
  const bundleStr = fs.readFileSync(fileName, { encoding: "utf8" });
  const bundle = JSON.parse(bundleStr) as Bundle<Resource>;

  // filter out historical data
  const numHistoricalYears = 2;
  const dateFrom = dayjs().subtract(numHistoricalYears, "year").format(ISO_DATE);
  const filteredBundle = filterConsolidated(bundle, { dateFrom });

  const inputString = prepareBundleForBrief(filteredBundle);
  if (saveBriefedBundle) {
    fs.writeFileSync(`${SOURCE_DIR}/${BRIEF_BUNDLE_FILE}`, inputString);
  }
  return;

  //   const splitter = new TokenTextSplitter({
  //     chunkSize: 10000,
  //     chunkOverlap: 250,
  //   });

  //   const chunks = await splitter.splitText(inputString ?? "");
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
  const summaryTemplate = `
${systemPrompt}

Today's date is ${todaysDate}.
Your goal is to write a summary of the patient's most recent medical history, so that another doctor can understand the patient's medical history to be able to treat them effectively.
Here is some of the patient's medical history:
--------
{text}
--------

Specify whether a DNR or POLST form has been completed.
Include a summary of the patient's most recent hospitalization, including the location of the hospitalization, the date of the hospitalization, the reason for the hospitalization, and the results of the hospitalization.
Include a summary of the patient's current chronic conditions, allergies, and any previous surgeries.
Include a summary of the patient's current medications, including dosages and frequency - do not include instructions on how to take the medications. Include any history of medication allergies or adverse reactions.
Include any other relevant information about the patient's health.

SUMMARY:
`;
  const SUMMARY_PROMPT = PromptTemplate.fromTemplate(summaryTemplate);

  const summaryTemplateRefined = `
${systemPrompt}

Today's date is ${todaysDate}.
Your goal is to write a summary of the patient's most recent medical history, so that another doctor can understand the patient's medical history to be able to treat them effectively.
Here is some of the patient's medical history:
--------
{text}
--------

Given the additional medical history, refine the summary to be more comprehensive and accurate, considering the following goals:
Specify whether a DNR or POLST form has been completed.
Include a summary of the patient's most recent hospitalization, including the location of the hospitalization, the date of the hospitalization, the reason for the hospitalization, and the results of the hospitalization.
Include a summary of the patient's current chronic conditions, allergies, and any previous surgeries.
Include a summary of the patient's current medications, including dosages and frequency - do not include instructions on how to take the medications. Include any history of medication allergies or adverse reactions.
Include any other relevant information about the patient's health.

SUMMARY:
`;
  const SUMMARY_PROMPT_REFINED = PromptTemplate.fromTemplate(summaryTemplateRefined);

  const summarizeChain = loadSummarizationChain(llmSummary, {
    type: "refine",
    verbose: true,
    questionPrompt: SUMMARY_PROMPT,
    refinePrompt: SUMMARY_PROMPT_REFINED,
  });

  const summary = await summarizeChain.invoke({
    input_documents: docs,
  });

  console.log(summary);
}

//--------------------------------
// Create a briefed bundle
//--------------------------------
async function createBriefedBundle() {
  const bundleRaw = fs.readFileSync(`${SOURCE_DIR}/${SOURCE_BUNDLE_FILE}`, "utf8");
  const bundle = JSON.parse(bundleRaw) as Bundle<Resource>;

  const inputString = prepareBundleForBrief(bundle);
  if (!inputString) return;

  fs.writeFileSync(`${SOURCE_DIR}/${BRIEF_BUNDLE_FILE}`, inputString);
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

    return slimResource;
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

function applyResourceSpecificFilters(res: Resource) {
  if (res.resourceType === "Patient") {
    res.name = getNameString(res.name);
  }

  if (res.resourceType === "AllergyIntolerance") {
    //TODO: Remove unknown manifestation
    res.status = Array.from(
      new Set(res.clinicalStatus?.coding?.flatMap(coding => coding.code || []))
    ).join(", ");
    if (res.status === "") delete res.status;
  }

  if (res.resourceType === "Immunization") {
    delete res.lotNumber; // ???

    if (res.vaccineCode) {
      const resVaccineCodeString = JSON.stringify(res.vaccineCode).toLowerCase();
      if (
        resVaccineCodeString.includes("no data") ||
        resVaccineCodeString.includes("no immunization")
      ) {
        res = {};
      }

      res.vaccineCode = getUniqueDisplays(res.vaccineCode);
    }

    delete res.doseQuantity;
  }

  if (res.resourceType === "Practitioner") {
    const name = getNameString(res.name);
    res.name = name;

    const qualificationsText = getUniqueDisplays(res.qualification?.[0]?.code);
    if (qualificationsText) res.qualification = qualificationsText;

    res.address = getAddressString(res.address);
  }

  if (res.resourceType === "Procedure") {
    const name = getUniqueDisplays(res.code);
    if (name) {
      res.name = name;
      if (name.includes("no data")) res = {};
    }

    delete res.code;

    if (res.status === "") delete res.status;

    delete res.reasonCode; // TODO: Introduce term server lookup here
  }

  if (res.resourceType === "DiagnosticReport") {
    const code = res.code?.text;
    if (code) res.code = code;

    const category = res.category
      ?.map(cat => cat.coding?.flatMap(coding => coding.display || []))
      .join(", ");
    if (category) res.category = category;

    if (res.presentedForm) {
      res.presentedForm.map(form => {
        delete form.contentType;
        if (form.data) {
          form.data = Buffer.from(form.data, "base64").toString("utf-8");
        }
      });
    }
  }

  if (res.resourceType === "Observation") {
    if (res.category) {
      const category = getUniqueDisplays(res.category);
      if (category) res.category = category;
    }

    const code = getUniqueDisplays(res.code);
    if (code) res.reading = code;

    if (res.valueCodeableConcept) {
      res.value = getUniqueDisplays(res.valueCodeableConcept);
      delete res.valueCodeableConcept;
    }

    if (res.valueQuantity) {
      res.value = getQuantityString(res.valueQuantity);
      delete res.valueQuantity;
    }

    if (res.interpretation) {
      res.interpretation = getUniqueDisplays(res.interpretation);
    }

    if (res.referenceRange) {
      res.referenceRange = res.referenceRange.map(range => {
        const low = getQuantityString(range.low);
        const high = getQuantityString(range.high);
        return {
          low,
          high,
        };
      });
    }

    delete res.code;
    delete res.performer;
  }

  if (res.resourceType === "Medication") {
    res.name = getUniqueDisplays(res.code);
    delete res.code;
  }

  if (res.resourceType === "MedicationRequest") {
    delete res.requester;
  }

  if (res.resourceType === "MedicationAdministration") {
    if (res.dosage) {
      const dose = getQuantityString(res.dosage.dose);
      if (dose) res.dose = dose;

      res.route = getUniqueDisplays(res.dosage.route);
      delete res.dosage;
    }
  }

  if (res.resourceType === "Condition") {
    res.name = getUniqueDisplays(res.code);
    delete res.code;

    res.category = getUniqueDisplays(res.category);

    res.clinicalStatus = getUniqueDisplays(res.clinicalStatus);
    if (res.clinicalStatus === "") delete res.clinicalStatus;
  }

  if (res.resourceType === "AllergyIntolerance") {
    res.clinicalStatus = getUniqueDisplays(res.clinicalStatus);

    if (res.reaction) {
      res.reaction = res.reaction.map(reaction => {
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
    res.address = getAddressString(res.address);
  }

  if (res.resourceType === "Location") {
    res.address = getAddressString(res.address);
    res.type = getUniqueDisplays(res.type);
  }

  return res;
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

function replaceReferencesWithData(
  res: Resource,
  map: Map<string, Resource>
): { updRes: any; ids: string[] } {
  const referencedIds = new Set<string>();

  if ("payor" in res) {
    const ref = toArray(res.payor);
    const orgRefs = ref.filter(r => r.reference?.includes("Organization"));
    orgRefs.map(org => {
      const refString = org.reference;
      if (refString) {
        const org = map.get(refString);
        referencedIds.add(refString);
        if (org && org.resourceType === "Organization") {
          res.payor = org.name;
        }
      }
    });
  }

  if ("beneficiary" in res) {
    const ref = res.beneficiary;
    if (ref.reference) {
      const refString = ref.reference;
      const pat = map.get(refString) as Patient | undefined;
      referencedIds.add(refString);
      if (pat && pat.resourceType === "Patient") {
        res.beneficiary = pat.name;
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

      res.diagnosis = diagnosesNames;
    }
  }

  if ("location" in res) {
    if (res.resourceType === "Encounter") {
      const locationRefs = res.location;
      res.location = locationRefs
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
      res.participant = res.participant?.map(part => {
        const refString = part.individual?.reference;
        if (refString) {
          const individual = map.get(refString);
          referencedIds.add(refString);
          if (
            individual?.resourceType === "Practitioner" ||
            individual?.resourceType === "RelatedPerson"
          ) {
            const upd = individual.name;

            return upd;
          }
        }
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
        res.performer = res.performer
          .flatMap(p => {
            const ref = p.reference;
            if (ref) {
              referencedIds.add(ref);
              const performer = map.get(ref);
              if (
                performer?.resourceType === "Organization" ||
                performer?.resourceType === "Practitioner"
              ) {
                return performer.name;
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
          res.performer = res.performer
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
          res.serviceProvider = org.name;
        } else {
          delete res.serviceProvider;
        }
      }
    }
  }

  if ("result" in res) {
    if (res.resourceType === "DiagnosticReport") {
      res.results = res.result?.map(resultRef => {
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
      });

      delete res.result;
    }
  }

  if ("medicationReference" in res) {
    const refString = res.medicationReference?.reference;
    if (refString) {
      const medication = map.get(refString) as Medication | undefined;
      referencedIds.add(refString);
      if (medication) {
        res.medication = { ...medication, id: undefined, resourceType: undefined };
        delete res.medicationReference;
      }
    }
  }

  if ("recorder" in res) {
    const refString = res.recorder?.reference;
    if (refString) {
      const individual = map.get(refString);
      referencedIds.add(refString);
      if (individual && individual.resourceType === "Practitioner") {
        res.practitioner = { ...individual, id: undefined };
        delete res.recorder;
      }
    }
  }

  if ("manufacturer" in res && res.resourceType === "Immunization") {
    if (res.manufacturer) {
      if (res.manufacturer.display) {
        res.manufacturer = res.manufacturer.display;
      } else if (res.manufacturer.reference) {
        const refString = res.manufacturer.reference;
        const org = map.get(refString);
        referenceIds.add(refString);

        if (org) {
          res.manufacturer = { ...org, id: undefined };
        }
      }
    }
  }

  return { updRes: res, ids: Array.from(referencedIds) };

  // KEEPING THESE FOR REFERENCE:

  // if ("encounter" in entry) {
  //   const encounterRef = entry.encounter;
  //   if (encounterRef?.reference && danglingLinks.has(encounterRef.reference))
  //     delete entry.encounter;
  // }

  // if ("author" in entry) {
  //   if (entry.resourceType === "Composition") {
  //     entry.author = entry.author?.filter(
  //       author => author.reference && !danglingLinks.has(author.reference)
  //     );
  //     if (!entry.author?.length) {
  //       entry.author = [{ display: "No Known Author" }];
  //     }
  //   }
  // }
  // if ("custodian" in entry) {
  //   if (entry.custodian?.reference && danglingLinks.has(entry.custodian.reference))
  //     delete entry.custodian;
  // }
  // if ("section" in entry) {
  //   entry.section = entry.section.map(section => {
  //     if (section.entry)
  //       section.entry = section.entry.filter(
  //         entry => entry.reference && !danglingLinks.has(entry.reference)
  //       );
  //     return section;
  //   });
  // }

  // if ("requester" in entry) {
  //   if (entry.requester?.reference && danglingLinks.has(entry.requester.reference))
  //     delete entry.requester;
  // }

  //   if (res.performer.length === 0) {
  //     delete res.performer;
  //   }
  // } else {
  //   if (res.performer?.reference && danglingLinks.has(res.performer.reference)) {
  //     delete res.performer;
  //   }
  // }

  // if ("recorder" in entry) {
  //   if (entry.recorder?.reference && danglingLinks.has(entry.recorder.reference))
  //     delete entry.recorder;
  // }

  // if ("payor" in entry) {
  //   entry.payor = entry.payor?.filter(
  //     payor => payor.reference && !danglingLinks.has(payor.reference)
  //   );
  //   if (!entry.payor?.length) delete entry.payor;
  // }
  // if ("attester" in entry) {
  //   entry.attester = entry.attester?.filter(
  //     attester => attester.party?.reference && !danglingLinks.has(attester.party.reference)
  //   );
  //   if (!entry.attester?.length) delete entry.attester;
  // }
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

createBriefedBundle();

// summarizeFilteredBundleWithAI();
