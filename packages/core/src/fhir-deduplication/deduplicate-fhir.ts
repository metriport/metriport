import { Bundle, EncounterDiagnosis, Resource } from "@medplum/fhirtypes";
import {
  ExtractedFhirTypes,
  buildCompleteBundleEntry,
  extractFhirTypesFromBundle,
  initExtractedFhirTypes,
} from "../external/fhir/bundle/bundle";
import { capture } from "../util";
import { deduplicateAllergyIntolerances } from "./resources/allergy-intolerance";
import { deduplicateCompositions } from "./resources/composition";
import { deduplicateConditions } from "./resources/condition";
import { deduplicateCoverages } from "./resources/coverage";
import { deduplicateDiagReports } from "./resources/diagnostic-report";
import { processDocumentReferences } from "./resources/document-reference";
import { deduplicateEncounters } from "./resources/encounter";
import { deduplicateFamilyMemberHistories } from "./resources/family-member-history";
import { deduplicateImmunizations } from "./resources/immunization";
import { deduplicateLocations } from "./resources/location";
import { deduplicateMedications } from "./resources/medication";
import { deduplicateMedAdmins } from "./resources/medication-administration";
import { deduplicateMedRequests } from "./resources/medication-request";
import { deduplicateMedStatements } from "./resources/medication-statement";
import { deduplicateObservations } from "./resources/observation";
import { deduplicateObservationsSocial } from "./resources/observation-social";
import { deduplicateOrganizations } from "./resources/organization";
import { deduplicatePractitioners } from "./resources/practitioner";
import { deduplicateProcedures } from "./resources/procedure";
import { deduplicateRelatedPersons } from "./resources/related-person";
import { createRef } from "./shared";

const medicationRelatedTypes = [
  "MedicationStatement",
  "MedicationAdministration",
  "MedicationRequest",
];

/**
 * This function is dangerous because it mutates the bundle in place.
 *
 * @param {Object} params - The parameters for deduplication
 * @param {string} params.cxId - The customer ID
 * @param {string} params.patientId - The patient ID
 * @param {Bundle<Resource>} params.bundle - The FHIR bundle to deduplicate
 */
export function dangerouslyDeduplicateFhir(
  fhirBundle: Bundle<Resource>,
  cxId: string,
  patientId: string
): void {
  let resourceArrays = extractFhirTypesFromBundle(fhirBundle);

  const compositionsResult = deduplicateCompositions(resourceArrays.compositions);
  resourceArrays.compositions = compositionsResult.combinedResources;

  const medicationsResult = deduplicateMedications(resourceArrays.medications);
  /* WARNING we need to replace references in the following resource arrays before deduplicating them because their deduplication keys 
  use medication references. This is different than all other resources.
  */
  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap, [
    "medicationAdministrations",
    "medicationStatements",
    "medicationRequests",
  ]);
  resourceArrays.medications = medicationsResult.combinedResources;

  const medAdminsResult = deduplicateMedAdmins(resourceArrays.medicationAdministrations);
  resourceArrays.medicationAdministrations = medAdminsResult.combinedResources;

  const medRequestResult = deduplicateMedRequests(resourceArrays.medicationRequests);
  resourceArrays.medicationRequests = medRequestResult.combinedResources;

  const medStatementResult = deduplicateMedStatements(resourceArrays.medicationStatements);
  resourceArrays.medicationStatements = medStatementResult.combinedResources;

  resourceArrays.documentReferences = processDocumentReferences(resourceArrays.documentReferences);

  const practitionersResult = deduplicatePractitioners(resourceArrays.practitioners);
  resourceArrays.practitioners = practitionersResult.combinedResources;

  const organizationsResult = deduplicateOrganizations(resourceArrays.organizations);
  resourceArrays.organizations = organizationsResult.combinedResources;

  /* WARNING we need to replace references in the following resource arrays before deduplicating them because their deduplication keys 
  use practitioner references.
  */
  resourceArrays = replaceResourceReferences(
    resourceArrays,
    new Map<string, string>([...practitionersResult.refReplacementMap]),
    ["diagnosticReports"]
  );

  const conditionsResult = deduplicateConditions(resourceArrays.conditions);
  resourceArrays.conditions = conditionsResult.combinedResources;

  const allergiesResult = deduplicateAllergyIntolerances(resourceArrays.allergies);
  resourceArrays.allergies = allergiesResult.combinedResources;

  const encountersResult = deduplicateEncounters(resourceArrays.encounters);
  resourceArrays.encounters = encountersResult.combinedResources;

  const diagReportsResult = deduplicateDiagReports(resourceArrays.diagnosticReports);
  resourceArrays.diagnosticReports = diagReportsResult.combinedResources;

  const immunizationsResult = deduplicateImmunizations(resourceArrays.immunizations);
  resourceArrays.immunizations = immunizationsResult.combinedResources;

  const proceduresResult = deduplicateProcedures(resourceArrays.procedures);
  resourceArrays.procedures = proceduresResult.combinedResources;

  const obsSocialResult = deduplicateObservationsSocial(resourceArrays.observationSocialHistory);
  resourceArrays.observationSocialHistory = obsSocialResult.combinedResources;

  const obsLabsResult = deduplicateObservations(resourceArrays.observationLaboratory);
  resourceArrays.observationLaboratory = obsLabsResult.combinedResources;

  const obsVitalsResult = deduplicateObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = obsVitalsResult.combinedResources;

  const obsOthersResult = deduplicateObservations(resourceArrays.observationOther);
  resourceArrays.observationOther = obsOthersResult.combinedResources;

  const locationsResult = deduplicateLocations(resourceArrays.locations);
  resourceArrays.locations = locationsResult.combinedResources;

  const relatedPersonsResult = deduplicateRelatedPersons(resourceArrays.relatedPersons);
  resourceArrays.relatedPersons = relatedPersonsResult.combinedResources;

  const famMemHistoriesResult = deduplicateFamilyMemberHistories(
    resourceArrays.familyMemberHistories
  );
  resourceArrays.familyMemberHistories = famMemHistoriesResult.combinedResources;

  resourceArrays = replaceResourceReferences(resourceArrays, medicationsResult.refReplacementMap, [
    "coverages",
  ]);

  // This must come after organization deduplication, since it depends on it. Just like medication deduplication
  const coveragesResult = deduplicateCoverages(resourceArrays.coverages);
  resourceArrays.coverages = coveragesResult.combinedResources;
  // Combine all dangling references
  const danglingLinks = new Set([
    ...medicationsResult.danglingReferences,
    ...medAdminsResult.danglingReferences,
    ...medRequestResult.danglingReferences,
    ...medStatementResult.danglingReferences,
    ...practitionersResult.danglingReferences,
    ...conditionsResult.danglingReferences,
    ...allergiesResult.danglingReferences,
    ...encountersResult.danglingReferences,
    ...diagReportsResult.danglingReferences,
    ...immunizationsResult.danglingReferences,
    ...proceduresResult.danglingReferences,
    ...obsSocialResult.danglingReferences,
    ...obsLabsResult.danglingReferences,
    ...obsVitalsResult.danglingReferences,
    ...obsOthersResult.danglingReferences,
    ...locationsResult.danglingReferences,
    ...organizationsResult.danglingReferences,
    ...relatedPersonsResult.danglingReferences,
    ...famMemHistoriesResult.danglingReferences,
    ...coveragesResult.danglingReferences,
  ]);

  // Combine all the remaining replacementMaps into one map
  const combinedReplacementMap = new Map<string, string>([
    ...medAdminsResult.refReplacementMap,
    ...medRequestResult.refReplacementMap,
    ...medStatementResult.refReplacementMap,
    ...practitionersResult.refReplacementMap,
    ...conditionsResult.refReplacementMap,
    ...allergiesResult.refReplacementMap,
    ...encountersResult.refReplacementMap,
    ...diagReportsResult.refReplacementMap,
    ...immunizationsResult.refReplacementMap,
    ...proceduresResult.refReplacementMap,
    ...obsSocialResult.refReplacementMap,
    ...obsLabsResult.refReplacementMap,
    ...obsVitalsResult.refReplacementMap,
    ...obsOthersResult.refReplacementMap,
    ...locationsResult.refReplacementMap,
    ...organizationsResult.refReplacementMap,
    ...relatedPersonsResult.refReplacementMap,
    ...famMemHistoriesResult.refReplacementMap,
    ...coveragesResult.refReplacementMap,
  ]);

  resourceArrays = replaceResourceReferences(resourceArrays, combinedReplacementMap);

  // Remove resources with dangling links
  const { updatedResourceArrays, deletedRefs } = removeResourcesWithDanglingLinks(
    resourceArrays,
    danglingLinks
  );
  resourceArrays = updatedResourceArrays;

  // get dangling links inside compositions from medication related resources we deleted in
  // the previous call to removeResourcesWithDanglingLinks
  const { updatedResourceArrays: updatedResourceArrays2 } = removeResourcesWithDanglingLinks(
    resourceArrays,
    deletedRefs
  );
  resourceArrays = updatedResourceArrays2;

  if (!resourceArrays.patient) {
    capture.message("Critical Missing Patient in Deduplicate FHIR", {
      extra: {
        cxId,
        patientId,
        patient: resourceArrays.patient,
      },
      level: "error",
    });
  }

  fhirBundle.entry = Object.entries(resourceArrays)
    .filter(([resourceType]) => resourceType !== "devices")
    .flatMap(([, resources]) => {
      const entriesArray = Array.isArray(resources) ? resources : [resources];
      return entriesArray
        .flatMap(v => v || [])
        .map(removeDuplicateReferences)
        .map(entry => buildCompleteBundleEntry(entry, fhirBundle.type));
    });
  fhirBundle.total = fhirBundle.entry.length;
}

export function removeResourcesWithDanglingLinks(
  resourceArrays: ExtractedFhirTypes,
  danglingLinks: Set<string>
): { updatedResourceArrays: ExtractedFhirTypes; deletedRefs: Set<string> } {
  const deletedRefs = new Set<string>();
  const updatedResourceArrays = initExtractedFhirTypes(resourceArrays.patient);

  for (const [key, resources] of Object.entries(resourceArrays)) {
    if (Array.isArray(resources)) {
      const updatedResources: Resource[] = [];
      for (const resource of resources) {
        const result = removeDanglingReferences(resource, danglingLinks);
        if (!result) {
          const ref = createRef(resource);
          deletedRefs.add(ref);
        } else {
          updatedResources.push(result);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedResourceArrays[key as keyof ExtractedFhirTypes] = updatedResources as any;
    } else {
      updatedResourceArrays.patient = resources;
    }
  }

  return { updatedResourceArrays, deletedRefs };
}

function removeDanglingReferences<T extends Resource>(
  entry: T,
  danglingLinks: Set<string>
): T | undefined {
  if (!entry) return entry;

  if (medicationRelatedTypes.includes(entry.resourceType)) {
    if ("medicationReference" in entry && entry.medicationReference?.reference) {
      if (danglingLinks.has(entry.medicationReference.reference)) {
        return undefined;
      }
    }
  }

  if ("result" in entry && Array.isArray(entry.result)) {
    entry.result = entry.result.filter(
      item => item?.reference && !danglingLinks.has(item.reference)
    );
    if (entry.result.length === 0) delete entry.result;
  }

  if ("encounter" in entry) {
    const encounterRef = entry.encounter;
    if (encounterRef?.reference && danglingLinks.has(encounterRef.reference))
      delete entry.encounter;
  }
  if ("diagnosis" in entry) {
    if (entry.resourceType === "Encounter") {
      const diagnoses = entry.diagnosis as EncounterDiagnosis[];
      entry.diagnosis = diagnoses.filter(
        diagnosis =>
          diagnosis.condition?.reference && !danglingLinks.has(diagnosis.condition.reference)
      );
      if (!entry.diagnosis.length) delete entry.diagnosis;
    }
  }
  if ("author" in entry) {
    if (entry.resourceType === "Composition") {
      entry.author = entry.author?.filter(
        author => author.reference && !danglingLinks.has(author.reference)
      );
      if (!entry.author?.length) {
        entry.author = [{ display: "No Known Author" }];
      }
    }
  }
  if ("custodian" in entry) {
    if (entry.custodian?.reference && danglingLinks.has(entry.custodian.reference))
      delete entry.custodian;
  }
  if ("section" in entry) {
    entry.section = entry.section.map(section => {
      if (section.entry)
        section.entry = section.entry.filter(
          entry => entry.reference && !danglingLinks.has(entry.reference)
        );
      return section;
    });
  }
  if ("location" in entry) {
    if (entry.resourceType === "Encounter") {
      entry.location = entry.location.filter(
        location => location.location?.reference && !danglingLinks.has(location.location.reference)
      );
      if (!entry.location.length) delete entry.location;
    }
  }
  if ("participant" in entry) {
    if (entry.resourceType === "Encounter") {
      entry.participant = entry.participant?.filter(
        part => part.individual?.reference && !danglingLinks.has(part.individual.reference)
      );
      if (!entry.participant?.length) delete entry.participant;
    }
  }
  if ("requester" in entry) {
    if (entry.requester?.reference && danglingLinks.has(entry.requester.reference))
      delete entry.requester;
  }
  if ("performer" in entry) {
    if (Array.isArray(entry.performer)) {
      if (
        entry.resourceType === "DiagnosticReport" ||
        entry.resourceType === "Observation" ||
        entry.resourceType === "ServiceRequest"
      ) {
        entry.performer = entry.performer.filter(
          p => p.reference && !danglingLinks.has(p.reference)
        );
      } else if (
        entry.resourceType === "Immunization" ||
        entry.resourceType === "MedicationAdministration" ||
        entry.resourceType === "MedicationDispense" ||
        entry.resourceType === "MedicationRequest" ||
        entry.resourceType === "Procedure" ||
        entry.resourceType === "RiskAssessment"
      ) {
        entry.performer = entry.performer?.filter(
          p => p.actor?.reference && !danglingLinks.has(p.actor.reference)
        );
      }
      if (entry.performer.length === 0) {
        delete entry.performer;
      }
    } else {
      if (entry.performer?.reference && danglingLinks.has(entry.performer.reference)) {
        delete entry.performer;
      }
    }
  }
  if ("recorder" in entry) {
    if (entry.recorder?.reference && danglingLinks.has(entry.recorder.reference))
      delete entry.recorder;
  }
  if ("serviceProvider" in entry) {
    if (entry.serviceProvider?.reference && danglingLinks.has(entry.serviceProvider.reference))
      delete entry.serviceProvider;
  }
  if ("payor" in entry) {
    entry.payor = entry.payor?.filter(
      payor => payor.reference && !danglingLinks.has(payor.reference)
    );
    if (!entry.payor?.length) delete entry.payor;
  }
  if ("attester" in entry) {
    entry.attester = entry.attester?.filter(
      attester => attester.party?.reference && !danglingLinks.has(attester.party.reference)
    );
    if (!entry.attester?.length) delete entry.attester;
  }
  return entry;
}

export function removeDuplicateReferencesFromBundle<T extends Resource>(entries: T[]): T[] {
  return entries.map(removeDuplicateReferences);
}

function removeDuplicateReferences<T extends Resource>(entry: T): T {
  if (!entry) return entry;

  if ("result" in entry && entry.result) {
    const results = entry.result;
    if (Array.isArray(results)) {
      const uniqueResults = new Set();
      entry.result = results.filter(item => {
        if (uniqueResults.has(item.reference)) return false;
        uniqueResults.add(item.reference);
        return true;
      });
    }
  }

  if ("diagnosis" in entry && entry.diagnosis && entry.resourceType === "Encounter") {
    const diagnoses = entry.diagnosis as EncounterDiagnosis[];
    const uniqueDiagnoses = new Set();
    entry.diagnosis = diagnoses.filter(diagnosis => {
      if (uniqueDiagnoses.has(diagnosis.condition?.reference)) {
        return false;
      }
      uniqueDiagnoses.add(diagnosis.condition?.reference);
      return true;
    });
  }

  if ("author" in entry && entry.author && entry.resourceType === "Composition") {
    const uniqueAuthors = new Set();
    entry.author = entry.author?.filter(author => {
      if (uniqueAuthors.has(author.reference)) return false;
      uniqueAuthors.add(author.reference);
      return true;
    });
  }

  if ("section" in entry && entry.section) {
    entry.section = entry.section.map(section => {
      if (section.entry) {
        const uniqueEntries = new Set();
        section.entry = section.entry.filter(item => {
          if (uniqueEntries.has(item.reference)) return false;
          uniqueEntries.add(item.reference);
          return true;
        });
      }
      return section;
    });
  }

  if ("location" in entry && entry.location && entry.resourceType === "Encounter") {
    const uniqueLocations = new Set();
    entry.location = entry.location.filter(location => {
      if (uniqueLocations.has(location.location?.reference)) return false;
      uniqueLocations.add(location.location?.reference);
      return true;
    });
  }

  if ("participant" in entry && entry.participant && entry.resourceType === "Encounter") {
    const uniqueParticipants = new Set();
    entry.participant = entry.participant?.filter(part => {
      if (uniqueParticipants.has(part.individual?.reference)) return false;
      uniqueParticipants.add(part.individual?.reference);
      return true;
    });
  }

  if ("performer" in entry && entry.performer) {
    if (Array.isArray(entry.performer)) {
      const uniquePerformers = new Set<string>();
      if (
        entry.resourceType === "DiagnosticReport" ||
        entry.resourceType === "Observation" ||
        entry.resourceType === "ServiceRequest"
      ) {
        entry.performer = entry.performer.filter(performer => {
          if (performer.reference && !uniquePerformers.has(performer.reference)) {
            uniquePerformers.add(performer.reference);
            return true;
          }
          return false;
        });
      } else if (
        entry.resourceType === "Immunization" ||
        entry.resourceType === "MedicationAdministration" ||
        entry.resourceType === "MedicationDispense" ||
        entry.resourceType === "MedicationRequest" ||
        entry.resourceType === "Procedure" ||
        entry.resourceType === "RiskAssessment"
      ) {
        entry.performer = entry.performer.filter(performer => {
          if (performer.actor?.reference && !uniquePerformers.has(performer.actor.reference)) {
            uniquePerformers.add(performer.actor.reference);
            return true;
          }
          return false;
        });
      }
    }
  }

  if ("payor" in entry && entry.payor) {
    const uniquePayors = new Set();
    entry.payor = entry.payor?.filter(payor => {
      if (uniquePayors.has(payor.reference)) return false;
      uniquePayors.add(payor.reference);
      return true;
    });
  }

  return entry;
}

/**
 * Finds and updates references to the deduplicated resources
 */
function replaceResourceReferences(
  resourceArrays: ExtractedFhirTypes,
  refReplacementMap: Map<string, string>,
  resourceType?: string[]
): ExtractedFhirTypes {
  return Object.fromEntries(
    Object.entries(resourceArrays).map(([key, resources]) => {
      if (resourceType && !resourceType.includes(key)) {
        return [key, resources];
      }
      if (Array.isArray(resources)) {
        return [
          key,
          resources.map(resource => replaceResourceReference(resource, refReplacementMap)),
        ];
      } else {
        return [key, resources];
      }
    })
  );
}

function replaceResourceReference<T extends Resource>(
  entry: T,
  referenceMap: Map<string, string>
): T {
  if (!entry) return entry;

  if ("result" in entry && Array.isArray(entry.result)) {
    entry.result = entry.result.map(item => {
      if (item.reference) {
        const newReference = referenceMap.get(item.reference);
        if (newReference) item.reference = newReference;
      }
      return item;
    });
  }

  if (
    "diagnosis" in entry &&
    Array.isArray(entry.diagnosis) &&
    entry.resourceType === "Encounter"
  ) {
    entry.diagnosis = entry.diagnosis.map(diagnosis => {
      if (diagnosis.condition?.reference) {
        const newReference = referenceMap.get(diagnosis.condition.reference);
        if (newReference) diagnosis.condition.reference = newReference;
      }
      return diagnosis;
    });
  }

  if ("author" in entry && Array.isArray(entry.author) && entry.resourceType === "Composition") {
    entry.author = entry.author.map(author => {
      if (author.reference) {
        const newReference = referenceMap.get(author.reference);
        if (newReference) author.reference = newReference;
      }
      return author;
    });
  }

  if ("section" in entry && Array.isArray(entry.section)) {
    entry.section = entry.section.map(section => {
      if (section.entry) {
        section.entry = section.entry.map(item => {
          if (item.reference) {
            const newReference = referenceMap.get(item.reference);
            if (newReference) item.reference = newReference;
          }
          return item;
        });
      }
      return section;
    });
  }

  if ("location" in entry && Array.isArray(entry.location) && entry.resourceType === "Encounter") {
    entry.location = entry.location.map(location => {
      if (location.location?.reference) {
        const newReference = referenceMap.get(location.location.reference);
        if (newReference) location.location.reference = newReference;
      }
      return location;
    });
  }

  if (
    "participant" in entry &&
    Array.isArray(entry.participant) &&
    entry.resourceType === "Encounter"
  ) {
    entry.participant = entry.participant.map(part => {
      if (part.individual?.reference) {
        const newReference = referenceMap.get(part.individual.reference);
        if (newReference) part.individual.reference = newReference;
      }
      return part;
    });
  }
  if ("performer" in entry && Array.isArray(entry.performer)) {
    entry.performer = entry.performer.map(performer => {
      if ("reference" in performer) {
        const newReference = referenceMap.get(performer.reference);
        if (newReference) performer.reference = newReference;
      } else if ("actor" in performer && performer.actor?.reference) {
        const newReference = referenceMap.get(performer.actor?.reference);
        if (newReference) performer.actor.reference = newReference;
      }
      return performer;
    });
  }

  if ("payor" in entry && Array.isArray(entry.payor)) {
    entry.payor = entry.payor.map(payor => {
      if (payor.reference) {
        const newReference = referenceMap.get(payor.reference);
        if (newReference) payor.reference = newReference;
      }
      return payor;
    });
  }

  if ("encounter" in entry && entry.encounter?.reference) {
    const newReference = referenceMap.get(entry.encounter.reference);
    if (newReference) entry.encounter.reference = newReference;
  }

  if ("medicationReference" in entry && entry.medicationReference?.reference) {
    const newReference = referenceMap.get(entry.medicationReference.reference);
    if (newReference) {
      entry.medicationReference.reference = newReference;
    }
  }

  if ("recorder" in entry && entry.recorder?.reference) {
    const newReference = referenceMap.get(entry.recorder.reference);
    if (newReference) entry.recorder.reference = newReference;
  }

  if ("serviceProvider" in entry && entry.serviceProvider?.reference) {
    const newReference = referenceMap.get(entry.serviceProvider.reference);
    if (newReference) entry.serviceProvider.reference = newReference;
  }

  if ("reasonReference" in entry && Array.isArray(entry.reasonReference)) {
    entry.reasonReference = entry.reasonReference.map(reason => {
      if (reason.reference) {
        const newReference = referenceMap.get(reason.reference);
        if (newReference) reason.reference = newReference;
      }
      return reason;
    }) as typeof entry.reasonReference;
  }

  if (entry.resourceType === "Composition" && "section" in entry) {
    entry.section = entry.section.map(section => {
      if (section.entry) {
        section.entry = section.entry.map(entryRef => {
          if (entryRef.reference) {
            const newReference = referenceMap.get(entryRef.reference);
            if (newReference) {
              entryRef.reference = newReference;
            }
          }
          return entryRef;
        });
      }
      return section;
    });
  }

  return entry;
}
