import { Bundle, Medication, Observation, Patient, Resource } from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import { ISO_DATE, buildDayjs } from "@metriport/shared/common/date";
import {
  SlimCondition,
  SlimDiagnosticReport,
  SlimOrganization,
  SlimResource,
  applyResourceSpecificFilters,
  getSlimPatient,
} from "../../domain/ai-brief/modify-resources";
import { findDiagnosticReportResources, findPatientResource } from "../../external/fhir/shared";
import { filterBundleByDate } from "../consolidated/consolidated-filter-by-date";
import { getDatesFromEffectiveDateTimeOrPeriod } from "../consolidated/consolidated-filter-shared";
import { cloneDeep } from "lodash";
import { condenseBundle } from "../../domain/ai-brief/condense-bundle";
import { sizeInBytes } from "../../util/string";

const NUM_HISTORICAL_YEARS = 1;
const MAX_REPORTS_PER_GROUP = 3;

const referenceResources = ["Practitioner", "Organization", "Observation", "Location"];

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

import fs from "fs";

export function prepareBundleForAiSummarization(bundle: Bundle, log: typeof console.log) {
  const startedAt = Date.now();
  const latestReportDate = findDiagnosticReportResources(bundle)
    .flatMap(report => {
      return getDatesFromEffectiveDateTimeOrPeriod(report);
    })
    .filter((date): date is string => date !== undefined)
    .sort((a, b) => b.localeCompare(a))[0];
  const initialDate = latestReportDate ? buildDayjs(latestReportDate) : buildDayjs(new Date());
  const dateFrom = initialDate.subtract(NUM_HISTORICAL_YEARS, "year").format(ISO_DATE);
  const filteredBundle = filterBundleByDate(bundle, dateFrom);
  const slimPayloadBundle = buildSlimmerPayload(filteredBundle);

  const duration = Date.now() - startedAt;
  const metrics = {
    initialBundleSize: bundle.entry?.length,
    initialBundleBytes: sizeInBytes(JSON.stringify(bundle)),
    finalBundleSize: slimPayloadBundle?.length,
    finalBundleBytes: sizeInBytes(JSON.stringify(slimPayloadBundle)),
    durationMs: duration,
  };

  log(`Bundle filtering metrics: ${JSON.stringify(metrics)}`);

  const inputString = JSON.stringify(slimPayloadBundle);
  fs.writeFileSync("slimBundle.json", inputString);
  return inputString;
}

function buildSlimmerPayload(bundle: Bundle): SlimResource[] | undefined {
  if (bundle.entry?.length === 0) return undefined;

  const patient = findPatientResource(bundle);
  if (!patient) return undefined;

  // First pass to remove a ton of useless stuff and apply resource-specific modifications
  const leanBundleEntries = buildSlimmerBundle(bundle);
  if (!leanBundleEntries) return undefined;

  // Build a map of slim resources for cross-referencing
  const resourceMap = new Map<string, SlimResource>();
  leanBundleEntries.forEach(res => {
    if (!res || !res.id) return;
    const mapKey = `${res.resourceType}/${res.id}`;
    resourceMap.set(mapKey, res);
  });

  // TODO 2510 Review this, could try to do the logic that build containedResourceIds so we
  // have a single loop through leanBundleEntries
  // Replace the references with actual data and collect references for embedded resources
  const containedResourceIdsSet = new Set<string>();
  const processedEntries = leanBundleEntries.map(res => {
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

  const slimBundle = removeReferencesAndLeftOverResources(
    withFilteredReports,
    containedResourceIds,
    patient
  );

  return condenseBundle(slimBundle);
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

/**
 * Takes a FHIR resource and replaces referenced resources with the actual contents of those resources.
 * This allows the context for a resource to be contained entirely within itself.
 * It also keeps track of the referenced resources, so those can later be removed from the bundle.
 */
function replaceReferencesWithData(
  res: SlimResource,
  map: Map<string, SlimResource>
): { updRes: SlimResource; ids: string[] } {
  const updRes = cloneDeep(res);
  const referencedIds = new Set<string>();
  if (!updRes.reference) updRes.reference = {};

  if ("performer" in updRes) {
    if (updRes.resourceType === "DiagnosticReport" || updRes.resourceType === "Observation") {
      const performers = toArray(updRes.performer);
      delete updRes.performer;
      const orgs: string[] = [];
      const practitioners: string[] = [];

      performers.forEach(p => {
        const ref = p.reference;
        if (!ref) return;

        referencedIds.add(ref);
        const performer = map.get(ref);

        if (performer?.resourceType === "Organization") {
          const name = typeof performer.name === "string" ? performer.name.trim() : "";
          if (name.length > 0) orgs.push(name);
        } else if (performer?.resourceType === "Practitioner") {
          const name = performer.name;
          if (name) practitioners.push(name);
        }
      });

      if (orgs.length > 0) {
        updRes.reference["organizations"] = orgs.join(", ");
      }
      if (practitioners.length > 0) {
        updRes.reference["practitioners"] = practitioners.join(", ");
      }
    } else if (
      updRes.resourceType === "Immunization" ||
      updRes.resourceType === "MedicationAdministration" ||
      updRes.resourceType === "MedicationRequest" ||
      updRes.resourceType === "Procedure"
    ) {
      const performers = Array.isArray(updRes.performer) ? updRes.performer : [updRes.performer];
      delete updRes.performer;

      const practitioner = performers
        .flatMap(perf => {
          const refString =
            "actor" in perf
              ? perf.actor.reference
              : "reference" in perf
              ? perf.reference
              : undefined;

          if (refString) {
            const actor = map.get(refString);
            referencedIds.add(refString);
            if (actor && "name" in actor) {
              const name = actor.name;
              return name ?? [];
            }
          }
          return [];
        })
        .join(", ");
      updRes.reference = { ...updRes.reference, practitioner };
    }
  }

  if ("result" in updRes) {
    if (updRes.resourceType === "DiagnosticReport") {
      const results = updRes.result?.flatMap(resultRef => {
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
      updRes.reference = { ...updRes.reference, results };
    }
  }

  if ("medicationReference" in updRes) {
    const refString = updRes.medicationReference?.reference;
    if (refString) {
      const medication = map.get(refString) as Medication | undefined;
      const medicationCopy = cloneDeep(medication);

      referencedIds.add(refString);
      if (medicationCopy) {
        delete medicationCopy.id;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { resourceType, ...otherFields } = medicationCopy;

        updRes.reference = { ...updRes.reference, medication: { ...otherFields } };
        delete updRes.medicationReference;
      }
    }
  }

  if ("reasonReference" in updRes) {
    const reasonsSet = new Set<string>();
    updRes.reasonReference.forEach(r => {
      const refString = r.reference;
      if (refString) {
        const condition = map.get(refString) as SlimCondition | undefined;
        if (condition?.name) {
          condition.name.split(", ").forEach(n => {
            reasonsSet.add(n);
          });
        }
      }
    });
    updRes.reference = {
      ...updRes.reference,
      reasons: Array.from(reasonsSet).join(", "),
    };
    delete updRes.reasonReference;
  }

  if ("recorder" in updRes) {
    const refString = updRes.recorder?.reference;
    if (refString) {
      const individual = map.get(refString);
      const individualCopy = cloneDeep(individual);

      referencedIds.add(refString);
      if (individualCopy && individualCopy.resourceType === "Practitioner") {
        delete individualCopy.id;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { resourceType, ...otherFields } = individualCopy;

        if (Object.values(otherFields).length > 0) {
          updRes.reference = { ...updRes.reference, practitioner: { ...otherFields } };
        }
        delete updRes.recorder;
      }
    }
  }

  if ("manufacturer" in updRes && updRes.resourceType === "Immunization") {
    if (updRes.manufacturer) {
      const manufacturer = updRes.manufacturer;
      delete updRes.manufacturer;
      if (manufacturer.display) {
        updRes.reference = { ...updRes.reference, manufacturer: { name: manufacturer.display } };
      } else if (manufacturer.reference) {
        const refString = manufacturer.reference;
        const org = map.get(refString) as SlimOrganization;
        const orgCopy = cloneDeep(org);

        referencedIds.add(refString);

        if (orgCopy) {
          delete orgCopy.id;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { resourceType, ...otherFields } = orgCopy;

          updRes.reference = { ...updRes.reference, manufacturer: { ...otherFields } };
        }
      }
    }
  }

  const refArray = toArray(updRes.reference);
  if (refArray.length === 0 || (refArray[0] && Object.keys(refArray[0]).length === 0)) {
    delete updRes.reference;
  }
  return { updRes, ids: Array.from(referencedIds) };
}

function filterOutDiagnosticReports(entries: SlimResource[]): SlimResource[] {
  const reports: SlimDiagnosticReport[] = [];
  const otherEntries = entries.filter(entry => {
    if (entry.resourceType === "DiagnosticReport") {
      reports.push(entry);
      return false;
    }
    return true;
  });
  const withOnlyLatestLabs = filterOutOldLabs(reports);
  const withLimitedReportsPerPerformer = filterReportsByPerformerAndCategory(withOnlyLatestLabs);
  const withoutDuplicateReports = filterOutDuplicateReports(withLimitedReportsPerPerformer);

  return [...withoutDuplicateReports, ...otherEntries];
}

function filterOutOldLabs(reports: SlimDiagnosticReport[]): SlimDiagnosticReport[] {
  const NUM_MOST_RECENT_LABS_TO_KEEP = 2;

  const labReports = reports.filter(
    report =>
      report.category &&
      !Array.isArray(report.category) &&
      typeof report.category === "string" &&
      report.category.toLowerCase().includes("relevant diagnostic tests and/or laboratory data")
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

function filterReportsByPerformerAndCategory(
  reports: SlimDiagnosticReport[]
): SlimDiagnosticReport[] {
  const reportGroups = new Map<string, SlimDiagnosticReport[]>();

  reports.forEach(report => {
    const performer = report.performer ?? "unknown";
    const type = report.type ?? "unknown";
    const key = `${performer}|${type}`;

    if (!reportGroups.has(key)) {
      reportGroups.set(key, []);
    }
    reportGroups.get(key)?.push(report);
  });

  const filteredReports: SlimDiagnosticReport[] = [];

  reportGroups.forEach(group => {
    const sortedGroup = group.sort((a, b) => {
      const aDates = getDatesFromEffectiveDateTimeOrPeriod(a);
      const bDates = getDatesFromEffectiveDateTimeOrPeriod(b);

      const aDate = aDates.find(d => d !== undefined);
      const bDate = bDates.find(d => d !== undefined);

      if (!aDate) return 1;
      if (!bDate) return -1;
      return bDate.localeCompare(aDate);
    });

    filteredReports.push(...sortedGroup.slice(0, MAX_REPORTS_PER_GROUP));
  });

  return filteredReports;
}

/**
 * This function checks if the contents of the presentedForm.data is fully contained within other diagnostic reports.
 * It does so by seeing if every single sentence in a report already exists in the collection of reports, in which case it filters this report out.
 */
function filterOutDuplicateReports(reports: SlimDiagnosticReport[]): SlimDiagnosticReport[] {
  const formDataSet = new Set<string>();
  return reports.filter(entry => {
    if (entry.presentedForm) {
      const paragraphFromUniqueSentences: string[] = [];
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
        paragraphFromUniqueSentences.push(filteredSentences.join(". "));
      });

      const combinedParagraphs = paragraphFromUniqueSentences.join("\n");
      if (combinedParagraphs.length === 0) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Removes the resources that are already references by other resources from the bundle.
 * Removes resource IDs and empty objects.
 * Removes resources that don't provide any useful information unless they are referenced by another resource.
 * Adds the SlimPatient into the bundle.
 */
function removeReferencesAndLeftOverResources(
  resources: SlimResource[],
  containedResourceIds: string[],
  patient: Patient
): SlimResource[] {
  const slimmerPatient = getSlimPatient(patient);
  const cleanPayload: SlimResource[] = [];

  resources?.forEach(entry => {
    if (Object.keys(entry).length === 0) return;
    if (referenceResources.includes(entry.resourceType)) return;
    if (entry.id && containedResourceIds.includes(entry.id)) return;

    delete entry.id;
    cleanPayload.push({ ...entry });
  });
  cleanPayload.push(slimmerPatient);

  return cleanPayload;
}
